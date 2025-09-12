import logging
import duckdb

import pyarrow as pa

logger = logging.getLogger(__name__)

from functools import partial
from typing import Optional
from . import db_async
from .cache import retrieve

def insert_table_from_arrow_file(con, query):
    file_name = query.get("fileName")
    table_name = query.get("tableName")
    with pa.memory_map(file_name, 'r') as source:
        arrow_file_data = pa.ipc.open_file(source).read_all()
    con.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM arrow_file_data")

def get_arrow(con, sql):
    try:
        logger.debug(f"Executing DuckDB query: {sql[:100]}{'...' if len(sql) > 100 else ''}")
        result = con.query(sql)
        if result is None:
            # Create empty result set if the query returns no rows
            empty_schema = pa.schema([pa.field('empty', pa.null())])
            arrow_result = pa.Table.from_batches([], schema=empty_schema)
            return arrow_result
        else:
            try:
                arrow_result = result.arrow()
                logger.debug(f"Successfully converted query result to Arrow format ({arrow_result.num_rows} rows)")
                return arrow_result
            except Exception as e:
                logger.error(f"Failed to convert result to Arrow: {str(e)}")
                raise

    except duckdb.Error as e:
        logger.error(f"DuckDB error during query execution: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during query execution: {str(e)}")
        raise


def arrow_to_bytes(arrow):
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, arrow.schema) as writer:
        writer.write(arrow)
    return sink.getvalue().to_pybytes()



def get_arrow_bytes(con, sql):
    return arrow_to_bytes(get_arrow(con, sql))


def get_json(con, sql):
    raise NotImplementedError("JSON output is disabled; use 'arrow' over WebSocket")


async def run_duckdb(cache, query, query_id: Optional[str] = None):
    """
    Run a DuckDB command asynchronously via db_async.run_db_task, returning a structured result.

    The actual DB work runs in a thread, using a per-task cursor. Cursor-level settings are
    applied inside the worker. Cancellation is handled by db_async.
    """
    def _execute_with_cursor(con: duckdb.DuckDBPyConnection):
        # Per-cursor configuration
        try:
            con.execute("SET enable_geoparquet_conversion = false")
        except Exception:
            pass

        sql = query.get("sql")
        command = query["type"]
        logger.debug(f"run_duckdb executing command '{command}'")
        if command == "arrow":
            buffer = retrieve(cache, query, partial(get_arrow_bytes, con))
            return {"type": "arrow", "data": buffer}
        else:
            raise ValueError("Only 'arrow' command is supported")

    return await db_async.run_db_task(_execute_with_cursor, query_id=query_id)
