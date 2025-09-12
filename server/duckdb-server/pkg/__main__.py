import logging
import sys
import os
import argparse
import traceback
import time
import duckdb
from diskcache import Cache

from pkg.server import server, init_global_connection

logger = logging.getLogger(__name__)
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


def serve(db_path=None, port=3000):
    start_time = time.time()
    
    # Print startup diagnostic information
    logger.info("="*50)
    logger.info("Python backend starting with:")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info(f"Command arguments: db_path={db_path}, port={port}")
    logger.info(f"Startup timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    def log_timing(step_name):
        elapsed = time.time() - start_time
        logger.info(f"TIMING: {step_name} completed at {elapsed:.3f} seconds")
    
    log_timing("Initial startup")
    
    if not db_path:
        logger.error("No database path provided. Please specify a path using --db-path.")
        sys.exit(1)
    
    logger.info(f"Using DuckDB from {db_path}")
    logger.info(f"Using port {port}")
    
    # Check if the database directory exists
    db_dir = os.path.dirname(db_path)
    if not os.path.exists(db_dir):
        logger.warning(f"Database directory does not exist: {db_dir}")
        try:
            os.makedirs(db_dir, exist_ok=True)
            logger.info(f"Created database directory: {db_dir}")
        except Exception as e:
            logger.exception(f"Error creating database directory: {e}")
            sys.exit(1)
    else:
        logger.info(f"Database directory exists: {db_dir}")
    
    log_timing("Directory check")

    # Check if the file exists but is not a valid DuckDB database
    try:
        if os.path.exists(db_path) and os.path.getsize(db_path) == 0:
            logger.warning(f"Found empty database file at {db_path}, will create a new one")
            os.remove(db_path)
    except Exception as e:
        logger.exception(f"Error checking database file: {e}")
        # If there's any error checking the file, try to remove it
        try:
            os.remove(db_path)
            logger.info(f"Removed potentially corrupted database file: {db_path}")
        except Exception:
            logger.exception(f"Failed to remove database file: {db_path}")
    
    log_timing("Database file check")

    # Connect to DuckDB (this will create a new DB if it doesn't exist)
    try:
        logger.info(f"Attempting to connect to DuckDB at {db_path}")

        duckdb_start = time.time()
        # Initialize the global connection instead of creating a local one
        init_global_connection(db_path)
        duckdb_time = time.time() - duckdb_start
        logger.info(f"TIMING: DuckDB connection took {duckdb_time:.3f} seconds")
        
        cache_start = time.time()
        cache = Cache()
        cache_time = time.time() - cache_start
        logger.info(f"TIMING: Cache initialization took {cache_time:.3f} seconds")
        
        logger.info(f"DuckDB connection established successfully")
        logger.info(f"Caching in {cache.directory}")
        
        log_timing("Backend initialization complete")
        
        # Start the server
        logger.info(f"Starting server on port {port}")
        server_start = time.time()
        server(cache, port)
        server_time = time.time() - server_start
        logger.info(f"TIMING: Server startup took {server_time:.3f} seconds")
    except duckdb.duckdb.IOException as e:
        # If we get an IO error, the file might be corrupted
        logger.error(f"Database file error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error during startup: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    overall_start = time.time()
    logger.info(f"TIMING: Process started at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    parser = argparse.ArgumentParser(description='DuckDB Server')
    parser.add_argument('--db-path', type=str, help='Path to the DuckDB database file')
    parser.add_argument('--port', type=int, default=3000, help='Port to listen on')
    args = parser.parse_args()
    
    args_time = time.time() - overall_start
    logger.info(f"TIMING: Argument parsing took {args_time:.3f} seconds")
    
    try:
        serve(args.db_path, args.port)
    except Exception as e:
        logger.critical(f"Unhandled exception in main: {e}")
        logger.critical(traceback.format_exc())
        sys.exit(1)
