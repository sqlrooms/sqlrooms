import logging
import random
from hashlib import sha256
from functools import partial
from typing import Optional
from . import db_async
import pyarrow as pa
import time

logger = logging.getLogger(__name__)

# Transaction conflict retry configuration
MAX_CONFLICT_RETRIES = 5
BASE_BACKOFF_MS = 10
MAX_BACKOFF_MS = 500
JITTER_FACTOR = 0.3


def _calculate_backoff(attempt: int) -> float:
    """
    Calculate exponential backoff with jitter in seconds.

    Args:
        attempt: Zero-based attempt number (0 = first retry)

    Returns:
        Backoff duration in seconds
    """
    base_delay = min(BASE_BACKOFF_MS * (2**attempt), MAX_BACKOFF_MS)
    jitter = base_delay * JITTER_FACTOR * random.random()
    return (base_delay + jitter) / 1000.0


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
    with cache.lock(lock_name):
        result = cache.get(key)
        if result is not None:
            logger.debug("Cache hit")
            return result
        value = get(sql)
        if query.get("persist", False):
            cache[key] = value
        return value


def get_arrow(con, sql):
    # Always use explicit transaction to keep it active during .to_arrow_table().
    # Without this, DuckDB's auto-commit closes the transaction after con.query(),
    # causing "ActiveTransaction called without active transaction" when Arrow export
    # needs to look up CRS metadata for geometry columns.
    con.execute("BEGIN TRANSACTION")
    try:
        result = con.query(sql)
        if result is None:
            con.execute("COMMIT")
            return None
        arrow_result = result.to_arrow_table()
        con.execute("COMMIT")
        return arrow_result
    except Exception as e:
        try:
            con.execute("ROLLBACK")
        except Exception:
            pass
        err_msg = str(e)
        if "ActiveTransaction" in err_msg or "active transaction" in err_msg.lower():
            # Explicit transaction wasn't enough; fall back to casting geometry to WKB
            logger.warning(
                "Transaction error during Arrow export despite explicit transaction; "
                "falling back to ST_AsWKB cast"
            )
            return _get_arrow_cast_geometry(con, sql)
        logger.error(f"Failed to convert result to Arrow: {err_msg}")
        raise


def _get_arrow_cast_geometry(con, sql):
    """Cast GEOMETRY columns to WKB BLOB to avoid Arrow export CRS lookup entirely."""
    try:
        wrapped = f"SELECT * FROM ({sql}) AS __q"
        desc = con.query(wrapped).description
        projections = []
        for col_desc in desc:
            col_name = col_desc[0]
            col_type = col_desc[1] if len(col_desc) > 1 else ""
            type_str = str(col_type).upper() if col_type else ""
            if "GEOMETRY" in type_str or "GEO" in type_str:
                projections.append(f'ST_AsWKB("{col_name}") AS "{col_name}"')
            else:
                projections.append(f'"{col_name}"')
        cast_sql = f"SELECT {', '.join(projections)} FROM ({sql}) AS __q"
        result = con.query(cast_sql)
        return result.to_arrow_table()
    except Exception as fallback_err:
        logger.error(f"Geometry WKB cast workaround also failed: {fallback_err}")
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
        msg = str(exc).lower()
        # Match various DuckDB MVCC conflict patterns:
        # - "Transaction conflict" - general conflict
        # - "Conflict on update" - update conflicts
        # - "write-write conflict" - catalog/DDL conflicts
        return (
            "transaction conflict" in msg
            or "conflict on" in msg
            or "write-write conflict" in msg
        )

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
                if attempts < MAX_CONFLICT_RETRIES and _is_conflict_error(e):
                    backoff = _calculate_backoff(attempts)
                    logger.warning(
                        f"Transaction conflict detected (attempt {attempts + 1}/{MAX_CONFLICT_RETRIES}); "
                        f"retrying in {backoff * 1000:.1f}ms. Error: {e}"
                    )
                    attempts += 1
                    time.sleep(backoff)
                    continue
                if _is_conflict_error(e):
                    logger.error(
                        f"Transaction conflict persisted after {MAX_CONFLICT_RETRIES} retries. Error: {e}"
                    )
                raise

    return await db_async.run_db_task(_execute_with_cursor, query_id=query_id)
