import logging
import sys
import argparse
import os
import signal
import threading
import faulthandler

from diskcache import Cache

from .server import server
from . import db_async

logger = logging.getLogger(__name__)
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
faulthandler.enable()


_def_initialized = False
_shutdown_started = False


def serve(
    db_path=":memory:",
    port=4000,
    extensions: list[str] | None = None,
    auth_token: str | None = None,
    sync_enabled: bool = False,
    meta_db: str | None = None,
    meta_namespace: str = "__sqlrooms",
    save_debounce_ms: int = 500,
):
    global _def_initialized
    if not db_path:
        db_path = ":memory:"
    logger.info(f"Using DuckDB from {db_path}")
    logger.info(f"Using port {port}")
    if meta_db:
        logger.info(
            f"Meta DB enabled; attaching meta DB at {meta_db} under namespace {meta_namespace}"
        )
    else:
        logger.info(f"Meta DB disabled; storing meta tables in schema {meta_namespace}")
    if sync_enabled:
        logger.info("Sync enabled")
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
        meta_db_path=meta_db,
        meta_namespace=meta_namespace,
        save_debounce_ms=save_debounce_ms,
        # In local dev, `:memory:` resets on restart (watchdog), so allow clients to
        # seed empty rooms via `crdt-snapshot` (server still rejects snapshots once
        # the room has state).
        allow_client_snapshots=bool(sync_enabled and db_path == ":memory:"),
    )


def main(argv: list[str] | None = None) -> int:
    """
    CLI entrypoint for the WS-only SQLRooms server.

    This is used by the `sqlrooms-server` console scripts.
    """
    parser = argparse.ArgumentParser(description="SQLRooms DuckDB websocket server")
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
        action="store_true",
        dest="sync",
        help="Enable optional sync (CRDT) over WebSocket",
    )
    parser.add_argument(
        "--meta-db",
        type=str,
        dest="meta_db",
        help="Optional path to a dedicated DuckDB file for SQLRooms meta tables (UI state + CRDT snapshots). If omitted, uses a schema within the main DB.",
    )
    parser.add_argument(
        "--meta-namespace",
        type=str,
        default="__sqlrooms",
        dest="meta_namespace",
        help="Namespace for SQLRooms meta tables (default: __sqlrooms). If --meta-db is provided, used as ATTACH alias; otherwise used as a schema in the main DB.",
    )
    parser.add_argument(
        "--save-debounce-ms",
        type=int,
        default=500,
        help="CRDT snapshot save debounce delay in milliseconds (default: 500)",
    )
    args = parser.parse_args(argv)

    exts = None
    if args.extensions:
        exts = [s.strip() for s in args.extensions.split(",") if s.strip()]

    sync_enabled = bool(args.sync)

    serve(
        args.db_path,
        args.port,
        extensions=exts,
        auth_token=args.auth_token,
        sync_enabled=sync_enabled,
        meta_db=args.meta_db,
        meta_namespace=args.meta_namespace,
        save_debounce_ms=args.save_debounce_ms,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
