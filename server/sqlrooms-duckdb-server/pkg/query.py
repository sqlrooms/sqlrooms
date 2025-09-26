import logging
from hashlib import sha256
from functools import partial
from typing import Optional
from . import db_async
from diskcache import Lock as DiskCacheLock
import pyarrow as pa
import time

logger = logging.getLogger(__name__)


def get_key(sql, command):
    return f"{sha256(sql.encode('utf-8')).hexdigest()}.{command}"


def retrieve(cache, query, get):
    sql = query.get("sql")
    command = query.get("type")

    key = get_key(sql, command)
    if cache is None:
        return get(sql)

    # Prevent concurrent computes for the same key (avoids DDL races)
    lock_name = f"lock:{key}"
    with DiskCacheLock(cache, lock_name):
        result = cache.get(key)
        if result is not None:
            logger.debug("Cache hit")
            return result
        value = get(sql)
        if query.get("persist", False):
            cache[key] = value
        return value


def get_arrow(con, sql):
    result = con.query(sql)
    if result is None:
        return None
    else:
        try:
            arrow_result = result.to_arrow_table()
            return arrow_result
        except Exception as e:
            logger.error(f"Failed to convert result to Arrow: {str(e)}")
            raise


def arrow_to_bytes(table):
    if table is None:
        return None
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        # Prefer write_table if available for efficiency
        if hasattr(writer, "write_table"):
            writer.write_table(table)
        else:
            for batch in table.to_batches():
                writer.write_batch(batch)
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
    logger.debug(
        f"Executing DuckDB query:\n{query['sql'][:256]}{'...' if len(query['sql']) > 256 else ''}"
    )

    def _is_conflict_error(exc: Exception) -> bool:
        msg = str(exc)
        return "Transaction conflict" in msg

    def _execute_once(con):
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

    def _execute_with_cursor(con):
        attempts = 0
        while True:
            try:
                return _execute_once(con)
            except Exception as e:
                if attempts < 1 and _is_conflict_error(e):
                    attempts += 1
                    logger.warning(
                        f"Transaction conflict detected; retrying once. Error: {e}"
                    )
                    time.sleep(0.01)
                    continue
                raise

    return await db_async.run_db_task(_execute_with_cursor, query_id=query_id)
