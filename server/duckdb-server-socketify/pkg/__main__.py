import logging
import sys
import argparse
import os
import time
import signal

from diskcache import Cache

from pkg.server import server
from . import db_async

logger = logging.getLogger(__name__)
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


def serve(db_path=None, port=3000):
    start_time = time.time()
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

    cache = Cache()
    logger.info(f"Caching in {cache.directory}")

    def _graceful_shutdown(signum, frame):
        logger.info(f"Received signal {signum}. Cancelling active queries and shutting down.")
        try:
            db_async.cancel_all_queries()
        except Exception:
            pass
        try:
            db_async.shutdown_executor(wait=False)
        except Exception:
            pass
        try:
            sys.exit(0)
        except SystemExit:
            return

    signal.signal(signal.SIGINT, _graceful_shutdown)
    signal.signal(signal.SIGTERM, _graceful_shutdown)

    server(cache, port)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='DuckDB Socketify Server')
    parser.add_argument('--db-path', type=str, help='Path to the DuckDB database file')
    parser.add_argument('--port', type=int, default=3000, help='Port to listen on')
    args = parser.parse_args()
    serve(args.db_path, args.port)
