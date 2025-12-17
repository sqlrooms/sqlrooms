import logging
import sys
import time
import asyncio
import json
import concurrent.futures
import base64

import ujson
from socketify import App, CompressOptions, OpCode
from .auth import AuthManager

from pkg.query import run_duckdb
from . import db_async

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
            send({"type": "json", "queryId": query_id, "data": result["data"]}, OpCode.TEXT)
        elif rtype == "ok":
            send({"type": "ok", "queryId": query_id}, OpCode.TEXT)
        else:
            send(
                {"type": "error", "queryId": query_id, "error": "Unexpected result type"},
                OpCode.TEXT,
            )
    except concurrent.futures.CancelledError:
        send({"type": "error", "queryId": query_id, "error": "Query was cancelled"}, OpCode.TEXT)
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
    sync_db_path: str | None = None,
    sync_schema: str = "__sqlrooms",
    allow_client_snapshots: bool = False,
):
    # SSL server
    # app = App(AppOptions(key_file_name="./localhost-key.pem", cert_file_name="./localhost.pem"))
    app = App()

    # faster serialization than standard json
    app.json_serializer(ujson)

    # Auth helper
    auth = AuthManager(auth_token)

    crdt_enabled = bool(sync_enabled)
    # NOTE: do not key routing on the Python `ws` object identity; socketify may wrap the
    # same underlying socket with a new Python object per callback. Instead, store routing
    # state in per-connection user_data (ws.get_user_data()).
    _next_conn_id = 0
    _conn_state: dict[int, dict[str, str | None]] = {}
    crdt_state = None
    empty_snapshot_len: int | None = None
    if crdt_enabled:
        try:
            from pkg import crdt as crdt_mod

            db_async.init_crdt_storage(namespace=sync_schema, attached_db_path=sync_db_path)
            crdt_state = crdt_mod.CrdtState()
            try:
                empty_snapshot_len = len(
                    crdt_mod.LoroDoc().export(crdt_mod.ExportMode.Snapshot())
                )
            except Exception:
                empty_snapshot_len = None
        except Exception:
            logger.exception("Failed to initialize CRDT module")
            raise

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
        # Store only a small, immutable primitive in socketify user_data to reduce
        # risk of native lifetime/GC issues. Keep mutable state in a Python dict.
        _conn_state[conn_id] = {"room_id": None, "client_id": None}
        try:
            res.upgrade(key or "", protocol or "", extensions or "", socket_context, conn_id)
        except Exception:
            # Best-effort; if upgrade fails, socketify will close
            try:
                res.close()
            except Exception:
                pass

    async def _crdt_join(ws, room_id: str):
        if not crdt_enabled:
            ws.send({"type": "error", "error": "CRDT disabled"}, OpCode.TEXT)
            return
        assert crdt_state is not None
        try:
            conn_id = int(ws.get_user_data())  # type: ignore[attr-defined]
        except Exception:
            conn_id = None
        state = _conn_state.get(conn_id, {}) if conn_id is not None else {}
        client_id = state.get("client_id")
        logger.info(
            f"joining room {room_id} (ws id: {id(ws)}, conn_id: {conn_id}, client_id: {client_id})"
        )
        room = await crdt_state.ensure_loaded(room_id)
        if conn_id is not None and conn_id in _conn_state:
            _conn_state[conn_id]["room_id"] = room_id
        ws.subscribe(room_id)
        ws.send({"type": "crdt-joined", "roomId": room_id}, OpCode.TEXT)
        # Export snapshot under lock; loro bindings may not be safe under concurrent access.
        async with room.lock:
            snapshot = room.doc.export(crdt_mod.ExportMode.Snapshot())
        logger.debug(f"sending snapshot to {room_id}: {len(snapshot)} bytes")
        ws.send(
            {
                "type": "crdt-snapshot",
                "roomId": room_id,
                "data": base64.b64encode(snapshot).decode("ascii"),
            },
            OpCode.TEXT,
        )

    async def _crdt_update(ws, payload: bytes):
        try:
            conn_id = int(ws.get_user_data())  # type: ignore[attr-defined]
        except Exception:
            conn_id = None
        state = _conn_state.get(conn_id, {}) if conn_id is not None else {}
        client_id = state.get("client_id")
        logger.debug(
            f"_crdt_update called with payload len: {len(payload)} bytes (ws id: {id(ws)}, conn_id: {conn_id}, client_id: {client_id})"
        )
        if not crdt_enabled:
            ws.send({"type": "error", "error": "CRDT disabled"}, OpCode.TEXT)
            return
        assert crdt_state is not None
        room_id = state.get("room_id")
        logger.debug(f"resolved room_id: {room_id} (ws id: {id(ws)}, conn_id: {conn_id})")
        if not room_id:
            logger.warning("no room_id found")
            # If we somehow missed join, ignore this update to avoid noisy errors
            return
        room = await crdt_state.ensure_loaded(room_id)
        async with room.lock:
            try:
                room.doc.import_(payload)
                # Broadcast the exact update we received so other peers can apply it
                update = payload
                await crdt_state.save_snapshot(room_id, room.doc)
                saved_snapshot = room.doc.export(crdt_mod.ExportMode.Snapshot())
                logger.debug(f"saved snapshot for {room_id}: {len(saved_snapshot)} bytes")
            except Exception as exc:
                logger.exception("Failed to handle CRDT update")
                ws.send({"type": "error", "error": str(exc)}, OpCode.TEXT)
                return
        logger.debug(f"publishing update to room {room_id}, len: {len(update)} bytes")
        # Send to all peers in the room except the originating websocket to avoid
        # echoing the update back and causing client-side loops.
        # for peer, peer_room in list(ws_rooms.items()):
        #     if peer_room != room_id or peer is ws:
        #         continue
        #     _ws_send(peer, update, OpCode.BINARY)
        app.publish(room_id, update, OpCode.BINARY)
        logger.debug(f"published update to room {room_id}")
        _ws_send(ws, {"type": "crdt-update-ack", "roomId": room_id}, OpCode.TEXT)

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
        # CRDT join: { type: 'crdt-join', roomId }
        if crdt_enabled and isinstance(query, dict) and query.get("type") == "crdt-join":
            room_id = str(query.get("roomId") or "").strip()
            if not room_id:
                ws.send({"type": "error", "error": "missing roomId"}, OpCode.TEXT)
                return
            try:
                conn_id = int(ws.get_user_data())  # type: ignore[attr-defined]
                if conn_id in _conn_state:
                    _conn_state[conn_id]["room_id"] = room_id
                    _conn_state[conn_id]["client_id"] = str(query.get("clientId") or "")
            except Exception:
                pass
            await _crdt_join(ws, room_id)
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

        # Full snapshot message from client: { type: 'crdt-snapshot', roomId, data }
        #
        # IMPORTANT: Client snapshots are disabled by default because accepting arbitrary
        # snapshots can wipe shared room state (e.g. a refreshing client sends an empty
        # snapshot before it loads local persistence).
        #
        # When enabled, we still only accept snapshots to *seed empty rooms* (see guard
        # below). This is useful for local dev when the server uses `:memory:` and can
        # restart/reset, requiring a client to re-seed state.
        if crdt_enabled and isinstance(query, dict) and query.get("type") == "crdt-snapshot":
            if not allow_client_snapshots:
                ws.send(
                    {"type": "error", "error": "client snapshots disabled"},
                    OpCode.TEXT,
                )
                return
            room_id = str(query.get("roomId") or "").strip()
            data_b64 = query.get("data")
            if not room_id or not isinstance(data_b64, str):
                ws.send({"type": "error", "error": "missing roomId or data"}, OpCode.TEXT)
                return
            try:
                payload = base64.b64decode(data_b64.encode("ascii"), validate=True)
            except Exception as exc:
                ws.send({"type": "error", "error": f"invalid snapshot: {exc}"}, OpCode.TEXT)
                return
            room = await crdt_state.ensure_loaded(room_id)
            # Guard: only allow seeding when the room is still empty.
            try:
                current = room.doc.export(crdt_mod.ExportMode.Snapshot())
                if empty_snapshot_len is None:
                    ws.send(
                        {"type": "error", "error": "snapshot rejected"},
                        OpCode.TEXT,
                    )
                    return
                if len(current) > empty_snapshot_len + 64:
                    ws.send(
                        {"type": "error", "error": "room already has state; snapshot rejected"},
                        OpCode.TEXT,
                    )
                    return
            except Exception:
                ws.send({"type": "error", "error": "snapshot rejected"}, OpCode.TEXT)
                return
            async with room.lock:
                try:
                    room.doc.import_(payload)
                    # Broadcast the same payload (snapshot) so peers can import it too
                    update = payload
                    await crdt_state.save_snapshot(room_id, room.doc)
                except Exception as exc:
                    logger.exception("Failed to handle CRDT snapshot message")
                    ws.send({"type": "error", "error": str(exc)}, OpCode.TEXT)
                    return
            app.publish(room_id, update, OpCode.BINARY)
            ws.send({"type": "crdt-snapshot-ack", "roomId": room_id}, OpCode.TEXT)
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
                app.publish(channel, ujson.dumps(payload))
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
                    if opcode == OpCode.TEXT and not isinstance(payload, (str, bytes, bytearray)):
                        try:
                            payload = ujson.dumps(payload)
                        except Exception:
                            payload = json.dumps(payload)
                        app.publish(channel, payload)
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
            if crdt_enabled:
                try:
                    await _crdt_update(ws, message_bytes)
                except Exception as exc:
                    logger.exception("Failed to process CRDT binary message")
                    ws.send({"type": "error", "error": str(exc)}, OpCode.TEXT)
                return
            ws.send({"type": "error", "error": "binary not supported"}, OpCode.TEXT)
            return

        if isinstance(message, (bytes, bytearray, memoryview)):
            if crdt_enabled:
                try:
                    await _crdt_update(
                        ws, message.tobytes() if isinstance(message, memoryview) else bytes(message)
                    )
                except Exception as exc:
                    logger.exception("Failed to process CRDT binary payload (bytes-like)")
                    ws.send({"type": "error", "error": str(exc)}, OpCode.TEXT)
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
                    "name": "sqlrooms-duckdb-server",
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
            "close": lambda ws, code, message: (
                logger.info(
                    f"ws closed code={code} reason={message} id={id(ws)}"
                ),
                (
                    (lambda: _conn_state.pop(int(ws.get_user_data()), None))()
                    if (hasattr(ws, "get_user_data"))
                    else None
                ),
                auth.on_close(ws),
            ),
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