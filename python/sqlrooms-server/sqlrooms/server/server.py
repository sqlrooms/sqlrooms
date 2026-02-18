import logging
import sys
import time
import asyncio
import json
import concurrent.futures

import ujson
from socketify import App, CompressOptions, OpCode
from .auth import AuthManager

from .query import run_duckdb
from . import db_async
from .crdt.ws import CrdtWs

logger = logging.getLogger(__name__)


def _build_arrow_frame(query_id: str, arrow_bytes: bytes) -> bytes:
    header_obj = {"type": "arrow", "queryId": query_id}
    header_bytes = json.dumps(header_obj).encode("utf-8")
    header_len = len(header_bytes).to_bytes(4, byteorder="big")
    return header_len + header_bytes + arrow_bytes


def _ws_send(ws, payload, opcode):
    """
    Best-effort wrapper around ws.send for use inside socketify callbacks.

    WARNING: Do not use this from background tasks after the websocket might close.
    Prefer `app.publish` to a per-connection channel in those cases.
    """
    ok = ws.send(payload, opcode)
    if not ok:
        logger.warning(f"WebSocket backpressure: {ws.get_buffered_amount()}")
    return ok


async def handle_query_ws(send, cache, query):
    start = time.time()
    query_id = query.get("queryId") or db_async.generate_query_id()
    try:
        result = await run_duckdb(cache, query, query_id=query_id)
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
    except concurrent.futures.CancelledError:
        send(
            {"type": "error", "queryId": query_id, "error": "Query was cancelled"},
            OpCode.TEXT,
        )
    except Exception as e:
        logger.exception("Error executing query")
        send({"type": "error", "queryId": query_id, "error": str(e)}, OpCode.TEXT)
    total = round((time.time() - start) * 1_000)
    logger.info(f"DONE. Query took {total} ms.")


def on_error(error, res, req):
    logger.error(str(error))
    if res is not None:
        res.write_status(500)
        res.end(f"Error {error}")


def server(
    cache,
    port=4000,
    auth_token: str | None = None,
    *,
    sync_enabled: bool = False,
    meta_db_path: str | None = None,
    meta_namespace: str = "__sqlrooms",
    allow_client_snapshots: bool = False,
    save_debounce_ms: int = 500,
):
    # SSL server
    # app = App(AppOptions(key_file_name="./localhost-key.pem", cert_file_name="./localhost.pem"))
    app = App()

    # faster serialization than standard json
    app.json_serializer(ujson)

    # Auth helper
    auth = AuthManager(auth_token)

    # Initialize meta storage (UI state + CRDT snapshots) regardless of whether sync is enabled.
    # This ensures the namespace exists for UI-side SQL persistence.
    db_async.init_meta_storage(namespace=meta_namespace, attached_db_path=meta_db_path)

    crdt_enabled = bool(sync_enabled)
    crdt_ws: CrdtWs | None = None
    empty_snapshot_len: int | None = None
    if crdt_enabled:
        try:
            from .crdt.state import CrdtState
            from loro import ExportMode, LoroDoc  # type: ignore

            crdt_state = CrdtState()
            db_async.register_shutdown_cleanup(crdt_state.flush_all)
            try:
                empty_snapshot_len = len(LoroDoc().export(ExportMode.Snapshot()))
            except Exception:
                empty_snapshot_len = None
            crdt_ws = CrdtWs(
                app=app,
                state=crdt_state,
                allow_client_snapshots=allow_client_snapshots,
                empty_snapshot_len=empty_snapshot_len,
                save_debounce_ms=save_debounce_ms,
                logger=logger,
            )
        except Exception:
            logger.exception("Failed to initialize CRDT module")
            raise

    # NOTE: `ws.send` can segfault if used from background tasks after close; we publish
    # query results to a per-connection topic `__conn:{conn_id}`. For that we need a stable
    # conn_id in socketify user_data.
    _next_conn_id = 0

    def ws_upgrade(res, req, socket_context):
        """Attach per-connection user_data so message handlers have stable state."""
        nonlocal _next_conn_id
        try:
            key = req.get_header("sec-websocket-key")
            protocol = req.get_header("sec-websocket-protocol")
            extensions = req.get_header("sec-websocket-extensions")
        except Exception:
            key = None
            protocol = None
            extensions = None

        _next_conn_id += 1
        conn_id = _next_conn_id
        if crdt_ws is not None:
            crdt_ws.register_conn(conn_id)
        try:
            res.upgrade(
                key or "", protocol or "", extensions or "", socket_context, conn_id
            )
        except Exception:
            # Best-effort; if upgrade fails, socketify will close
            try:
                res.close()
            except Exception:
                pass

    def ws_open(ws):
        auth.on_open(ws)
        # No-op: per-connection state is created during upgrade.
        # Subscribe to a private per-connection channel so background tasks can deliver
        # results via `app.publish` without calling `ws.send` after close.
        try:
            conn_id = int(ws.get_user_data())  # type: ignore[attr-defined]
            ws.subscribe(f"__conn:{conn_id}")
        except Exception:
            pass

    async def _process_message(ws, query):
        if crdt_ws is not None and isinstance(query, dict):
            try:
                conn_id = int(ws.get_user_data())  # type: ignore[attr-defined]
            except Exception:
                conn_id = -1
            handled = await crdt_ws.maybe_handle_json(
                ws, conn_id=conn_id, message=query
            )
            if handled:
                return

        # Cancellation message: { type: 'cancel', queryId }
        if isinstance(query, dict) and query.get("type") == "cancel":
            qid = query.get("queryId")
            cancelled = False
            if qid:
                cancelled = db_async.cancel_query(qid)
            ws.send(
                {"type": "cancelAck", "queryId": qid, "cancelled": bool(cancelled)},
                OpCode.TEXT,
            )
            return

        # Subscribe to a channel/topic: { type: 'subscribe', channel }
        if isinstance(query, dict) and query.get("type") == "subscribe":
            channel = query.get("channel")
            if channel:
                ws.subscribe(channel)
                ws.send({"type": "subscribed", "channel": channel}, OpCode.TEXT)
            else:
                ws.send({"type": "error", "error": "Missing channel"}, OpCode.TEXT)
            return

        # Publish a notification: { type: 'notify', channel, payload }
        if isinstance(query, dict) and query.get("type") == "notify":
            channel = query.get("channel")
            payload = {
                "type": "notify",
                "channel": channel,
                "payload": query.get("payload"),
            }
            if channel:
                # IMPORTANT: always publish JSON notifications as TEXT frames.
                # If we omit the opcode here, some clients may observe it as a binary
                # message and fail to parse it as JSON.
                app.publish(channel, ujson.dumps(payload), OpCode.TEXT)
                ws.send(payload, OpCode.TEXT)
                ws.send({"type": "notifyAck", "channel": channel}, OpCode.TEXT)
            else:
                ws.send({"type": "error", "error": "Missing channel"}, OpCode.TEXT)
            return

        # Query messages: only accept valid types with sql
        if (
            isinstance(query, dict)
            and query.get("type") in ("arrow", "json", "exec")
            and isinstance(query.get("sql"), str)
        ):
            try:
                try:
                    conn_id = int(ws.get_user_data())  # type: ignore[attr-defined]
                except Exception:
                    conn_id = None

                def _send_to_conn(payload, opcode):
                    # Publish to the per-connection channel; socketify will drop delivery if closed.
                    channel = f"__conn:{conn_id}" if conn_id is not None else None
                    if channel is None:
                        return False
                    if opcode == OpCode.TEXT and not isinstance(
                        payload, (str, bytes, bytearray)
                    ):
                        try:
                            payload = ujson.dumps(payload)
                        except Exception:
                            payload = json.dumps(payload)
                        # IMPORTANT: always publish JSON as TEXT frames.
                        # Without an explicit opcode, the underlying publish may deliver
                        # as binary, which breaks clients expecting JSON strings.
                        app.publish(channel, payload, OpCode.TEXT)
                        return True
                    app.publish(channel, payload, opcode)
                    return True

                asyncio.create_task(handle_query_ws(_send_to_conn, cache, query))
            except Exception as e:
                logger.exception("Failed to schedule query task")
                ws.send({"type": "error", "error": str(e)}, OpCode.TEXT)
            return

        ws.send({"type": "error", "error": "invalid message"}, OpCode.TEXT)

    async def ws_message(ws, message, opcode):
        # Handle binary upfront with its own error handling so we never emit "invalid json"
        if opcode == OpCode.BINARY:
            if isinstance(message, str):
                message_bytes = message.encode("latin-1", "ignore")
            elif isinstance(message, memoryview):
                message_bytes = message.tobytes()
            else:
                message_bytes = bytes(message)
            if crdt_ws is not None:
                try:
                    conn_id = int(ws.get_user_data())  # type: ignore[attr-defined]
                except Exception:
                    conn_id = -1
                try:
                    await crdt_ws.handle_binary_update(
                        ws, conn_id=conn_id, payload=message_bytes
                    )
                except Exception as exc:
                    logger.exception("Failed to process CRDT binary message")
                    ws.send({"type": "error", "error": str(exc)}, OpCode.TEXT)
                return
            ws.send({"type": "error", "error": "binary not supported"}, OpCode.TEXT)
            return

        if isinstance(message, (bytes, bytearray, memoryview)):
            if crdt_ws is not None:
                try:
                    conn_id = int(ws.get_user_data())  # type: ignore[attr-defined]
                except Exception:
                    conn_id = -1
                try:
                    await crdt_ws.handle_binary_update(
                        ws,
                        conn_id=conn_id,
                        payload=message.tobytes()
                        if isinstance(message, memoryview)
                        else bytes(message),
                    )
                except Exception as exc:
                    logger.exception(
                        "Failed to process CRDT binary payload (bytes-like)"
                    )
                    ws.send({"type": "error", "error": str(exc)}, OpCode.TEXT)
                return
            if crdt_enabled:
                # Sync was requested but CRDT handler failed to initialize.
                ws.send({"type": "error", "error": "CRDT unavailable"}, OpCode.TEXT)
                return
            msg_str = bytes(message).decode("utf-8", "ignore")
        else:
            msg_str = message

        try:
            query = ujson.loads(msg_str)
        except Exception:
            ws.send({"type": "error", "error": "invalid json"}, OpCode.TEXT)
            return

        # Delegate auth handling; if it handled the message (auth/unauthorized), stop
        if auth.handle_ws_message(ws, query):
            return

        await _process_message(ws, query)

    # Minimal HTTP endpoints for health and version only
    def _healthz(res, req):
        try:
            res.end("ok")
        except Exception:
            try:
                res.write_status(500)
                res.end("error")
            except Exception:
                pass

    def _readyz(res, req):
        try:
            if db_async.GLOBAL_CON is None:
                res.write_status(503)
                res.end("not ready")
            else:
                res.end("ok")
        except Exception:
            try:
                res.write_status(500)
                res.end("error")
            except Exception:
                pass

    def _version(res, req):
        try:
            import duckdb as _duckdb  # local import to avoid unused import warnings

            body = ujson.dumps(
                {
                    "name": "sqlrooms-server",
                    "python": sys.version,
                    "duckdb": getattr(_duckdb, "__version__", "unknown"),
                }
            )
            res.write_header("Content-Type", "application/json")
            res.end(body)
        except Exception:
            try:
                res.write_status(500)
                res.end('{"error":"version"}')
            except Exception:
                pass

    def ws_close(ws, code, message):
        logger.info(f"ws closed code={code} reason={message} id={id(ws)}")
        try:
            user_data = ws.get_user_data()  # type: ignore[attr-defined]
            if user_data is not None:
                conn_id = int(user_data)
                if crdt_ws is not None:
                    room_id = crdt_ws.get_room_id(conn_id)
                    if room_id:
                        # Flush room state before unregistering
                        asyncio.create_task(crdt_state.flush_room(room_id))
                    crdt_ws.unregister_conn(conn_id)
        except Exception:
            logger.exception("Error during ws_close cleanup")
        auth.on_close(ws)

    app.ws(
        "/*",
        {
            # Disable compression to avoid inflate errors and accept larger payloads.
            "compression": CompressOptions.SHARED_COMPRESSOR,
            # Raise payload limits/backpressure so large CRDT payloads (snapshot or updates)
            # don't trip the uWebSockets max size guard.
            "max_payload_length": 128 * 1024 * 1024,
            "max_backpressure": 64 * 1024 * 1024,
            "close_on_backpressure_limit": False,
            "upgrade": ws_upgrade,
            "open": ws_open,
            "message": ws_message,
            "drain": lambda ws: logger.warning(
                f"WebSocket backpressure: {ws.get_buffered_amount()}"
            ),
            "close": ws_close,
        },
    )

    # WS-only server; expose health/version endpoints
    app.get("/healthz", _healthz)
    app.get("/readyz", _readyz)
    app.get("/version", _version)

    app.set_error_handler(on_error)

    app.listen(
        port,
        lambda config: sys.stdout.write(
            f"DuckDB Server listening at ws://localhost:{config.port} (WS only). Health at http://localhost:{config.port}/healthz\n"
        ),
    )
    app.run()
