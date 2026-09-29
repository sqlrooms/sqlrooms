"""Transport-neutral DuckDB wire framing and result encoding."""

import asyncio
import concurrent.futures
from enum import IntEnum
import json
import logging
import re
import time
import uuid
from .query import run_duckdb

logger = logging.getLogger(__name__)


class OpCode(IntEnum):
    TEXT = 1
    BINARY = 2


def _build_arrow_frame(query_id: str, arrow_bytes: bytes) -> bytes:
    header_obj = {"type": "arrow", "queryId": query_id}
    header_bytes = json.dumps(header_obj).encode("utf-8")
    header_len = len(header_bytes).to_bytes(4, byteorder="big")
    return header_len + header_bytes + arrow_bytes


def _quote_ident(ident: str) -> str:
    return '"' + ident.replace('"', '""') + '"'


_IDENT_SEGMENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _normalize_target_relation(raw_name: str) -> str:
    """
    Validate and quote a target relation for CREATE TABLE.

    Accepted forms:
      - table
      - schema.table

    We intentionally reject quoted identifiers and any other SQL syntax to
    prevent SQL injection through uploadArrow tableName.
    """
    name = (raw_name or "").strip()
    if not name:
        raise ValueError("tableName is required")
    if len(name) > 255:
        raise ValueError("tableName is too long")
    parts = name.split(".")
    if len(parts) not in (1, 2):
        raise ValueError("tableName must be table or schema.table")
    for part in parts:
        if not _IDENT_SEGMENT_RE.fullmatch(part):
            raise ValueError(
                "tableName contains invalid characters; use letters, numbers, underscores"
            )
    return ".".join(_quote_ident(part) for part in parts)


def _parse_framed_binary(message_bytes: bytes):
    if len(message_bytes) < 4:
        return None
    header_len = int.from_bytes(message_bytes[:4], byteorder="big")
    if header_len <= 0 or 4 + header_len > len(message_bytes):
        return None
    header_raw = message_bytes[4 : 4 + header_len]
    try:
        header = json.loads(header_raw.decode("utf-8"))
    except Exception:
        return None
    payload = message_bytes[4 + header_len :]
    return header, payload


async def handle_query_ws(runtime, send, query, operation_id):
    start = time.time()
    query_id = query.get("queryId") or str(uuid.uuid4())
    try:
        result = await run_duckdb(runtime, runtime.cache, query, query_id=operation_id)
        rtype = result.get("type")
        if rtype == "arrow":
            data = result.get("data")
            if data is None:
                # Some statements executed with type "arrow" may produce no result
                send({"type": "ok", "queryId": query_id}, OpCode.TEXT)
            else:
                payload = _build_arrow_frame(query_id, data)  # bytes
                send(payload, OpCode.BINARY)
        elif rtype == "json":
            send(
                {"type": "json", "queryId": query_id, "data": result["data"]},
                OpCode.TEXT,
            )
        elif rtype == "ok":
            send({"type": "ok", "queryId": query_id}, OpCode.TEXT)
        else:
            send(
                {
                    "type": "error",
                    "queryId": query_id,
                    "error": "Unexpected result type",
                },
                OpCode.TEXT,
            )
    except (asyncio.CancelledError, concurrent.futures.CancelledError):
        send(
            {"type": "error", "queryId": query_id, "error": "Query was cancelled"},
            OpCode.TEXT,
        )
    except Exception as e:
        logger.exception("Error executing query")
        send({"type": "error", "queryId": query_id, "error": str(e)}, OpCode.TEXT)
    total = round((time.time() - start) * 1_000)
    logger.debug(f"DONE. Query took {total} ms.")


async def handle_upload_arrow_ws(
    runtime, ws, header: dict, payload: bytes, operation_id
):
    query_id = header.get("queryId") or str(uuid.uuid4())
    table_name = header.get("tableName")
    if not isinstance(table_name, str) or not table_name.strip():
        ws.send(
            {
                "type": "error",
                "queryId": query_id,
                "error": "Missing tableName for uploadArrow",
            },
            OpCode.TEXT,
        )
        return

    tmp_rel = "__sqlrooms_upload_" + str(query_id).replace("-", "_")
    tmp_rel_q = _quote_ident(tmp_rel)
    try:
        target_rel = _normalize_target_relation(table_name)
    except ValueError as exc:
        ws.send(
            {"type": "error", "queryId": query_id, "error": str(exc)},
            OpCode.TEXT,
        )
        return

    def _upload(cur):
        import pyarrow as pa

        reader = pa.ipc.open_stream(payload)
        table = reader.read_all()
        cur.register(tmp_rel, table)
        try:
            cur.execute(
                f"CREATE OR REPLACE TABLE {target_rel} AS SELECT * FROM {tmp_rel_q}"
            )
        finally:
            try:
                cur.unregister(tmp_rel)
            except Exception:
                pass

    try:
        await runtime.run_db_task(_upload, query_id=operation_id)
        ws.send({"type": "uploadAck", "queryId": query_id}, OpCode.TEXT)
    except (asyncio.CancelledError, concurrent.futures.CancelledError):
        ws.send(
            {"type": "error", "queryId": query_id, "error": "Query was cancelled"},
            OpCode.TEXT,
        )
    except Exception as e:
        logger.exception("Error handling Arrow upload")
        ws.send({"type": "error", "queryId": query_id, "error": str(e)}, OpCode.TEXT)
