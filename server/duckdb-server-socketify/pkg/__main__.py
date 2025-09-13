import logging
import sys
import argparse
import os
import time
import signal
import threading

from diskcache import Cache

from pkg.server import server
from . import db_async

logger = logging.getLogger(__name__)
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


_def_initialized = False
_shutdown_started = False


def serve(db_path=None, port=3000):
    global _def_initialized
    if not db_path:
        logger.error("No database path provided. Please specify a path using --db-path.")
        sys.exit(1)

    logger.info(f"Using DuckDB from {db_path}")
    logger.info(f"Using port {port}")

    # Ensure directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    # If the file exists but is empty (NamedTemporaryFile), remove it so DuckDB can create a valid DB
    try:
        if os.path.exists(db_path) and os.path.getsize(db_path) == 0:
            logger.warning(f"Found empty database file at {db_path}, removing before init")
            os.remove(db_path)
    except Exception as e:
        logger.exception(f"Error checking/removing empty database file: {e}")

    # Initialize global connection and cache, retry once on invalid file
    if not _def_initialized:
        try:
            db_async.init_global_connection(db_path)
        except Exception as e:
            # Handle invalid DB file errors by removing and retrying once
            try:
                if os.path.exists(db_path):
                    logger.warning(f"Removing invalid database file and retrying: {db_path}")
                    os.remove(db_path)
                    db_async.init_global_connection(db_path)
                else:
                    raise
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
        # Avoid logging from signal handler; write minimal message to stderr
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
            # Hard-exit process to stop event loop cleanly
            os._exit(0)
        threading.Thread(target=_do_shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, _graceful_shutdown)
    signal.signal(signal.SIGTERM, _graceful_shutdown)

    server(cache, port)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='DuckDB Socketify Server')
    parser.add_argument('--db-path', type=str, help='Path to the DuckDB database file')
    parser.add_argument('--port', type=int, default=3000, help='Port to listen on')
    args = parser.parse_args()
    serve(args.db_path, args.port)
