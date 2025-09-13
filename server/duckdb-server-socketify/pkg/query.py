import logging
from hashlib import sha256

import pyarrow as pa

logger = logging.getLogger(__name__)

from functools import partial
from typing import Optional
from . import db_async


def get_key(sql, command):
    return f"{sha256(sql.encode('utf-8')).hexdigest()}.{command}"


def retrieve(cache, query, get):
    sql = query.get("sql")
    command = query.get("type")

    key = get_key(sql, command)
    result = cache.get(key)

    if result:
        logger.debug("Cache hit")
    else:
        result = get(sql)
        if query.get("persist", False):
            cache[key] = result
    return result


def get_arrow(con, sql):
    return con.query(sql).arrow()


def arrow_to_bytes(arrow):
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, arrow.schema) as writer:
        writer.write(arrow)
    return sink.getvalue().to_pybytes()


def get_arrow_bytes(con, sql):
    return arrow_to_bytes(get_arrow(con, sql))


def get_json(con, sql):
    result = con.query(sql).df()
    return result.to_json(orient="records")


async def run_duckdb(cache, query, query_id: Optional[str] = None):
    """
    Run a DuckDB command asynchronously via db_async.run_db_task, returning a structured result.

    The actual DB work runs in a thread, using a per-task cursor. Cancellation is handled by db_async.
    """
    def _execute_with_cursor(con):
        command = query["type"]
        if command == "arrow":
            buffer = retrieve(cache, query, partial(get_arrow_bytes, con))
            return {"type": "arrow", "data": buffer}
        elif command == "json":
            data = retrieve(cache, query, partial(get_json, con))
            return {"type": "json", "data": data}
        elif command == "exec":
            sql = query.get("sql")
            con.execute(sql)
            return {"type": "ok"}
        else:
            raise ValueError(f"Unknown command {command}")

    return await db_async.run_db_task(_execute_with_cursor, query_id=query_id)
