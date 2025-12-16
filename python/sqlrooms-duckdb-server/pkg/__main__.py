import logging
import sys
import argparse
import os
import signal
import threading

from diskcache import Cache

from pkg.server import server
from . import db_async

logger = logging.getLogger(__name__)
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


_def_initialized = False
_shutdown_started = False


def serve(
    db_path=":memory:",
    port=4000,
    extensions: list[str] | None = None,
    auth_token: str | None = None,
    sync_enabled: bool = False,
    sync_db: str | None = None,
    sync_schema: str = "__sqlrooms",
):
    global _def_initialized
    if not db_path:
        db_path = ":memory:"
    logger.info(f"Using DuckDB from {db_path}")
    logger.info(f"Using port {port}")
    if sync_enabled:
        if sync_db:
            logger.info(
                f"Sync enabled; attaching sync DB at {sync_db} under namespace {sync_schema}"
            )
        else:
            logger.info(
                f"Sync enabled; storing snapshots in schema {sync_schema} within the main DB"
            )
    if auth_token:
        logger.info("Bearer authentication is ENABLED")

    # Ensure directory exists for file-backed DBs
    db_dir = os.path.dirname(db_path) if db_path != ":memory:" else ""
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    # If the file exists but is empty (NamedTemporaryFile), remove it so DuckDB can create a valid DB
    if db_path != ":memory:":
        try:
            if os.path.exists(db_path) and os.path.getsize(db_path) == 0:
                logger.warning(
                    f"Found empty database file at {db_path}, removing before init"
                )
                os.remove(db_path)
        except Exception as e:
            logger.exception(f"Error checking/removing empty database file: {e}")

    # Initialize global connection and cache, retry once on invalid file
    if not _def_initialized:
        try:
            db_async.init_global_connection(db_path, extensions=extensions)
        except Exception:
            logger.exception("Failed to initialize DuckDB connection")
            sys.exit(1)
        _def_initialized = True

    cache = Cache()
    logger.info(f"Caching in {cache.directory}")

    def _graceful_shutdown(signum, frame):
        global _shutdown_started
        if _shutdown_started:
            return
        _shutdown_started = True
        try:
            os.write(2, f"Received signal {signum}. Shutting down...\n".encode())
        except Exception:
            pass

        def _do_shutdown():
            try:
                db_async.begin_shutdown()
            except Exception:
                pass
            try:
                db_async.cancel_all_queries()
            except Exception:
                pass
            try:
                db_async.force_checkpoint_and_close()
            except Exception:
                pass
            try:
                db_async.shutdown_executor(wait=False)
            except Exception:
                pass
            os._exit(0)

        threading.Thread(target=_do_shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, _graceful_shutdown)
    signal.signal(signal.SIGTERM, _graceful_shutdown)

    server(
        cache,
        port,
        auth_token=auth_token,
        sync_enabled=sync_enabled,
        sync_db_path=sync_db,
        sync_schema=sync_schema,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DuckDB Socketify Server")
    parser.add_argument(
        "--db-path",
        type=str,
        default=":memory:",
        help="Path to the DuckDB database file (default :memory:)",
    )
    parser.add_argument("--port", type=int, default=4000, help="Port to listen on")
    parser.add_argument(
        "--extensions",
        type=str,
        help="Comma-separated list of extensions to preload (e.g. httpfs,spatial,h3@community)",
    )
    parser.add_argument(
        "--auth-token",
        type=str,
        help="If provided, require this bearer token for HTTP and WS clients",
    )
    parser.add_argument(
        "--sync",
        "--crdt",
        action="store_true",
        dest="sync",
        help="Enable optional sync (CRDT) over WebSocket",
    )
    parser.add_argument(
        "--sync-db",
        "--crdt-db",
        type=str,
        dest="sync_db",
        help="Optional path to a dedicated DuckDB file for sync snapshots (requires --sync). If omitted, uses a schema within the main DB.",
    )
    parser.add_argument(
        "--sync-schema",
        "--crdt-schema",
        type=str,
        default="__sqlrooms",
        dest="sync_schema",
        help="Namespace/schema to store sync snapshots (default: __sqlrooms). Used as ATTACH alias when --sync-db is provided.",
    )
    args = parser.parse_args()
    exts = None
    if args.extensions:
        exts = [s.strip() for s in args.extensions.split(",") if s.strip()]
    # Allow env var fallback if CLI flag not provided
    token = args.auth_token

    if any(flag in sys.argv for flag in ("--crdt", "--crdt-db", "--crdt-schema")):
        logger.warning(
            "Deprecated flags detected (--crdt/--crdt-db/--crdt-schema). Please migrate to --sync/--sync-db/--sync-schema."
        )

    sync_enabled = bool(args.sync)
    # Back-compat: if someone passes --sync-db without --sync, enable sync (but warn).
    if args.sync_db and not sync_enabled:
        logger.warning("--sync-db provided without --sync; enabling sync")
        sync_enabled = True

    serve(
        args.db_path,
        args.port,
        extensions=exts,
        auth_token=token,
        sync_enabled=sync_enabled,
        sync_db=args.sync_db,
        sync_schema=args.sync_schema,
    )
