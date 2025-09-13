import asyncio
import concurrent.futures
import logging
import os
import threading
import uuid
from typing import Callable, Optional, Any, Dict, Tuple

import duckdb

logger = logging.getLogger(__name__)

# Shared thread pool for executing DuckDB work off the event loop
# Sized to CPU count to avoid oversubscription
EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=os.cpu_count() or 4)

# Global DuckDB connection and path
GLOBAL_CON: Optional[duckdb.DuckDBPyConnection] = None
DATABASE_PATH: Optional[str] = None

# Track active queries for cancellation: query_id -> (Future, cursor)
active_queries: Dict[str, Tuple[concurrent.futures.Future, duckdb.DuckDBPyConnection]] = {}
active_queries_lock = threading.Lock()


def generate_query_id() -> str:
    """Generate a unique query id string (UUID4)."""
    return str(uuid.uuid4())


def register_query(query_id: str, future: concurrent.futures.Future, cursor: duckdb.DuckDBPyConnection) -> None:
    """Register an in-flight query for cancellation tracking."""
    with active_queries_lock:
        active_queries[query_id] = (future, cursor)


def unregister_query(query_id: str) -> None:
    """Remove a query from tracking (best-effort)."""
    with active_queries_lock:
        active_queries.pop(query_id, None)


def cancel_query(query_id: str) -> bool:
    """Interrupt a running DuckDB query by id. Returns True if found and signaled."""
    with active_queries_lock:
        entry = active_queries.get(query_id)
        if entry:
            future, con = entry
            try:
                if hasattr(con, "interrupt"):
                    con.interrupt()
                else:
                    duckdb.interrupt(con)
            except Exception as e:
                logger.error(f"Error interrupting query {query_id}: {e}")
            return True
        return False


def cancel_all_queries() -> None:
    """Cancel and close all active queries. Used on shutdown or reconnection."""
    with active_queries_lock:
        for query_id, (future, cursor) in list(active_queries.items()):
            try:
                cursor.close()
            except Exception as e:
                logger.warning(f"Error closing cursor for query {query_id}: {e}")
            if not future.done():
                future.cancel()
                logger.info(f"Cancelled query {query_id}")
        active_queries.clear()


def init_global_connection(database_path: str) -> None:
    """Initialize the global DuckDB connection and optimize for concurrent access."""
    global GLOBAL_CON, DATABASE_PATH
    GLOBAL_CON = duckdb.connect(database_path)
    DATABASE_PATH = database_path

    # Load useful extensions often used with SQLRooms
    try:
        GLOBAL_CON.install_extension("httpfs")
        GLOBAL_CON.load_extension("httpfs")
        GLOBAL_CON.install_extension("iceberg")
        GLOBAL_CON.load_extension("iceberg")
        GLOBAL_CON.install_extension("spatial")
        GLOBAL_CON.load_extension("spatial")
        GLOBAL_CON.install_extension("h3", repository="community")
        GLOBAL_CON.load_extension("h3")
    except Exception as e:
        logger.warning(f"Failed to install/load some extensions: {e}")

    cpu_count = os.cpu_count() or 4
    GLOBAL_CON.execute(f"SET threads TO {cpu_count}")
    logger.info(f"Initialized global DuckDB connection to {database_path} with {cpu_count} threads")


async def run_db_task(
    execute_with_cursor: Callable[[duckdb.DuckDBPyConnection], Any],
    *,
    query_id: Optional[str] = None,
):
    """Run synchronous DuckDB work in the shared pool with cancellation tracking.

    - Creates a per-task cursor from GLOBAL_CON
    - Execution function is responsible for any cursor-level settings
    - Registers future and cursor; on cancel, raises CancelledError
    - Ensures cursor is closed
    """
    if GLOBAL_CON is None:
        raise RuntimeError("Global DuckDB connection not initialized")
    cursor: duckdb.DuckDBPyConnection = GLOBAL_CON.cursor()

    def _runner(cur: duckdb.DuckDBPyConnection):
        try:
            return execute_with_cursor(cur)
        except duckdb.InterruptException as ie:
            raise concurrent.futures.CancelledError() from ie
        finally:
            try:
                cur.close()
            except Exception:
                pass

    qid = query_id or generate_query_id()
    future = EXECUTOR.submit(_runner, cursor)
    register_query(qid, future, cursor)
    try:
        return await asyncio.wrap_future(future)
    except asyncio.CancelledError:
        cancel_query(qid)
        raise
    finally:
        unregister_query(qid)


def shutdown_executor(wait: bool = False) -> None:
    """Shut down the shared ThreadPoolExecutor (best-effort)."""
    try:
        EXECUTOR.shutdown(wait=wait)
    except Exception:
        pass
