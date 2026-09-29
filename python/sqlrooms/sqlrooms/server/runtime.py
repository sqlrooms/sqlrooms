"""Instance-owned DuckDB execution, metadata and shutdown resources."""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
import logging
import os
from pathlib import Path
import threading
import uuid

import duckdb

from .cache import QueryCache
from .metadata import MetadataStorage

logger = logging.getLogger(__name__)


@dataclass
class Operation:
    """A cursor belongs to its worker until that worker closes it."""

    lock: threading.Lock = field(default_factory=threading.Lock)
    cursor: object = None
    cancelled: bool = False
    future: object = None

    def interrupt(self):
        with self.lock:
            self.cancelled = True
            if self.cursor is not None:
                self.cursor.interrupt()


class DuckDBRuntime(MetadataStorage):
    """One writable database and a bounded executor per workspace.

    Query IDs are supplied by the transport as connection-scoped operation IDs.
    Writes use DuckDB MVCC and the query runner's bounded conflict retries; a
    cursor is never shared between operations. Disconnect interrupts outstanding
    work but cannot roll back statements that already committed.
    """

    def __init__(
        self,
        database_path: str,
        storage_root: Path,
        *,
        extensions=None,
        meta_namespace="__sqlrooms",
        meta_db_path=None,
        max_workers=4,
        max_operations=64,
    ):
        self.database_path = database_path
        self.storage_root = Path(storage_root)
        self.extensions = ["httpfs"] if extensions is None else extensions
        self.meta_namespace = meta_namespace
        self.meta_db_path = meta_db_path
        self.max_operations = max_operations
        self.executor = ThreadPoolExecutor(
            max_workers=max_workers, thread_name_prefix="sqlrooms-db"
        )
        self.connection = None
        self.cache = QueryCache()
        self.operations: dict[str, Operation] = {}
        self.closing = False
        self.closed = False
        self._started = False
        self._startup_future = None
        self._shutdown_task = None
        self._persisted = False
        self._connection_lock = threading.Lock()

    @property
    def ready(self):
        """Whether new operations may be admitted."""
        return self._started and self.connection is not None and not self.closing

    async def start(self):
        """Open the database and metadata before publishing readiness."""

        def initialize():
            self.storage_root.mkdir(parents=True, exist_ok=True)
            self.connection = duckdb.connect(self.database_path)
            try:
                for spec in self.extensions:
                    name, repo = (spec.split("@", 1) + [None])[:2]
                    try:
                        if repo:
                            self.connection.install_extension(name, repository=repo)
                        else:
                            self.connection.install_extension(name)
                        self.connection.load_extension(name)
                    except Exception as exc:
                        logger.warning("Failed to load extension %s: %s", spec, exc)
                self.connection.execute(f"SET threads TO {os.cpu_count() or 4}")
                self.init_meta_storage(self.meta_namespace, self.meta_db_path)
            except BaseException:
                self.connection.close()
                self.connection = None
                raise

        if self._startup_future is not None or self.closing or self.closed:
            raise RuntimeError("Runtime cannot be started twice")
        self._startup_future = asyncio.get_running_loop().run_in_executor(
            self.executor, initialize
        )
        # A cancelled caller cannot cancel work already running in the executor.
        # Keep its future for close()/abort() to settle before touching the DB.
        await asyncio.shield(self._startup_future)
        if not self.closing:
            self._started = True

    async def _settle_startup(self):
        if self._startup_future is not None:
            try:
                await asyncio.shield(self._startup_future)
            except Exception:
                # start() reports the initialization error; shutdown still owns
                # the executor and any connection it managed to open.
                pass

    async def run_db_task(self, execute_with_cursor, *, query_id=None):
        """Run blocking work with bounded admission and isolated cancellation."""
        if not self.ready:
            raise RuntimeError("Database is not accepting work")
        if len(self.operations) >= self.max_operations:
            raise RuntimeError("Database busy: too many pending operations")
        query_id = query_id or str(uuid.uuid4())
        if query_id in self.operations:
            raise ValueError("Duplicate active queryId")
        operation = Operation()
        self.operations[query_id] = operation

        def execute():
            with operation.lock:
                if operation.cancelled:
                    raise duckdb.InterruptException("Query was cancelled")
                with self._connection_lock:
                    cursor = self.connection.cursor()
                operation.cursor = cursor
            try:
                return execute_with_cursor(cursor)
            finally:
                with operation.lock:
                    cursor.close()
                    operation.cursor = None

        future = asyncio.get_running_loop().run_in_executor(self.executor, execute)
        operation.future = future
        future.add_done_callback(lambda _done: self.operations.pop(query_id, None))
        try:
            return await asyncio.shield(future)
        except asyncio.CancelledError:
            operation.interrupt()
            # Keep the operation registered until its worker actually finishes.
            # Cancelling an asyncio wrapper never proves a write was rolled back.
            await asyncio.gather(asyncio.shield(future), return_exceptions=True)
            raise

    def cancel_query(self, query_id):
        """Interrupt only the cursor belonging to this operation."""
        operation = self.operations.get(query_id)
        if operation is None:
            return False
        operation.interrupt()
        return True

    async def close(self):
        """Stop admission, settle workers, checkpoint and close; propagate failures.

        A failed checkpoint leaves the connection available for a close retry,
        with admission stopped. It is never reported as a successful save.
        """
        if self.closed:
            if not self._persisted:
                raise RuntimeError("Runtime was aborted without confirmed persistence")
            return
        task = self._shutdown_task
        if task is None or task.done() and task.exception() is not None:
            task = self._begin_shutdown(checkpoint=True)
        await asyncio.shield(task)
        if not self._persisted:
            raise RuntimeError("Runtime was aborted without confirmed persistence")

    async def abort(self):
        """Release resources after a failed final save, without claiming persistence."""
        while not self.closed:
            task = self._shutdown_task
            if task is not None and not task.done():
                try:
                    await asyncio.shield(task)
                except Exception:
                    pass  # A failed checkpoint leaves the connection for abort.
                continue
            if task is not None and task.done():
                try:
                    task.result()
                except Exception:
                    pass
            if not self.closed:
                await asyncio.shield(self._begin_shutdown(checkpoint=False))

    def _begin_shutdown(self, *, checkpoint):
        self.closing = True
        task = asyncio.create_task(self._shutdown(checkpoint=checkpoint))
        # Retain both the task and its failure if the initiating caller leaves.
        task.add_done_callback(
            lambda done: done.exception() if not done.cancelled() else None
        )
        self._shutdown_task = task
        return task

    async def _shutdown(self, *, checkpoint):
        await self._settle_startup()
        for operation in list(self.operations.values()):
            operation.interrupt()
        await asyncio.gather(
            *(
                asyncio.shield(op.future)
                for op in list(self.operations.values())
                if op.future
            ),
            return_exceptions=True,
        )

        def finish():
            if self.connection is not None:
                if checkpoint:
                    self.connection.execute("CHECKPOINT")
                self.connection.close()

        await asyncio.shield(
            asyncio.get_running_loop().run_in_executor(self.executor, finish)
        )
        self.connection = None
        self.executor.shutdown(wait=True)
        self.closed = True
        self._persisted = checkpoint
