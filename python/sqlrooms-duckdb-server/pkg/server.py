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
    ok = ws.send(payload, opcode)
    if not ok:
        logger.warning(f"WebSocket backpressure: {ws.get_buffered_amount()}")
    return ok


async def handle_query_ws(ws, cache, query):
    start = time.time()
    query_id = query.get("queryId") or db_async.generate_query_id()
    try:
        result = await run_duckdb(cache, query, query_id=query_id)
        rtype = result.get("type")
        if rtype == "arrow":
            data = result.get("data")
            if data is None:
                # Some statements executed with type "arrow" may produce no result
                _ws_send(ws, {"type": "ok", "queryId": query_id}, OpCode.TEXT)
            else:
                payload = _build_arrow_frame(query_id, data)  # bytes
                _ws_send(ws, payload, OpCode.BINARY)
        elif rtype == "json":
            _ws_send(
                ws,
                {"type": "json", "queryId": query_id, "data": result["data"]},
                OpCode.TEXT,
            )
        elif rtype == "ok":
            _ws_send(ws, {"type": "ok", "queryId": query_id}, OpCode.TEXT)
        else:
            _ws_send(
                ws,
                {
                    "type": "error",
                    "queryId": query_id,
                    "error": "Unexpected result type",
                },
                OpCode.TEXT,
            )
    except concurrent.futures.CancelledError:
        ws.send(
            {"type": "error", "queryId": query_id, "error": "Query was cancelled"},
            OpCode.TEXT,
        )
    except Exception as e:
        logger.exception("Error executing query")
        ws.send({"type": "error", "queryId": query_id, "error": str(e)}, OpCode.TEXT)
    total = round((time.time() - start) * 1_000)
    logger.info(f"DONE. Query took {total} ms.")


def on_error(error, res, req):
    logger.error(str(error))
    if res is not None:
        res.write_status(500)
        res.end(f"Error {error}")


def server(cache, port=4000, auth_token: str | None = None, crdt_db_path: str | None = None):
    # SSL server
    # app = App(AppOptions(key_file_name="./localhost-key.pem", cert_file_name="./localhost.pem"))
    app = App()

    # faster serialization than standard json
    app.json_serializer(ujson)

    # Auth helper
    auth = AuthManager(auth_token)

    crdt_enabled = crdt_db_path is not None
    ws_rooms: dict[object, str] = {}
    ws_rooms_by_id: dict[int, str] = {}
    ws_rooms_by_peer: dict[object, str] = {}

    def _ws_key(ws):
        try:
            addr = ws.get_remote_address()  # type: ignore[attr-defined]
            if addr:
                return addr
        except Exception:
            pass
        return id(ws)
    if crdt_enabled:
        try:
            from pkg import crdt as crdt_mod

            db_async.attach_crdt_db(crdt_db_path)
            crdt_state = crdt_mod.CrdtState()
        except Exception:
            logger.exception("Failed to initialize CRDT module")
            raise

    async def _crdt_join(ws, room_id: str):
        if not crdt_enabled:
            ws.send({"type": "error", "error": "CRDT disabled"}, OpCode.TEXT)
            return
        peer_key = _ws_key(ws)
        print(f"joining room {room_id} (ws id: {id(ws)}, peer: {peer_key})")
        room = await crdt_state.ensure_loaded(room_id)
        ws._room_id = room_id  # type: ignore[attr-defined]
        ws.subscribe(room_id)
        ws.send({"type": "crdt-joined", "roomId": room_id}, OpCode.TEXT)
        snapshot = room.doc.export(crdt_mod.ExportMode.Snapshot())
        print(f"sending snapshot to {room_id}: {len(snapshot)} bytes")
        ws.send(
            {
                "type": "crdt-snapshot",
                "roomId": room_id,
                "data": base64.b64encode(snapshot).decode("ascii"),
            },
            OpCode.TEXT,
        )

    async def _crdt_update(ws, payload: bytes):
        peer_key = _ws_key(ws)
        print(
            f"_crdt_update called with payload len: {len(payload)} bytes (ws id: {id(ws)}, peer: {peer_key})"
        )
        if not crdt_enabled:
            ws.send({"type": "error", "error": "CRDT disabled"}, OpCode.TEXT)
            return
        room_id = getattr(ws, "_room_id", None)
        if room_id is None:
            room_id = (
                ws_rooms.get(ws)
                or ws_rooms_by_id.get(id(ws))
                or ws_rooms_by_peer.get(peer_key)
            )
        print(f"resolved room_id: {room_id} (ws id: {id(ws)}, peer: {peer_key})")
        if not room_id:
            print(f"no room_id found")
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
                print(f"saved snapshot for {room_id}: {len(saved_snapshot)} bytes")
            except Exception as exc:
                logger.exception("Failed to handle CRDT update")
                ws.send({"type": "error", "error": str(exc)}, OpCode.TEXT)
                return
        print(f"publishing update to room {room_id}")
        print(f"update len: {len(update)} bytes")
        app.publish(room_id, update, OpCode.BINARY)
        print(f"published update to room {room_id}")
        _ws_send(ws, {"type": "crdt-update-ack", "roomId": room_id}, OpCode.TEXT)

    def ws_open(ws):
        auth.on_open(ws)
        ws._room_id = None  # type: ignore[attr-defined]

    async def _process_message(ws, query):
        # CRDT join: { type: 'crdt-join', roomId }
        if crdt_enabled and isinstance(query, dict) and query.get("type") == "crdt-join":
            room_id = str(query.get("roomId") or "").strip()
            if not room_id:
                ws.send({"type": "error", "error": "missing roomId"}, OpCode.TEXT)
                return
            peer_key = _ws_key(ws)
            ws._room_id = room_id  # type: ignore[attr-defined]
            ws_rooms[ws] = room_id
            ws_rooms_by_id[id(ws)] = room_id
            ws_rooms_by_peer[peer_key] = room_id
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
        if crdt_enabled and isinstance(query, dict) and query.get("type") == "crdt-snapshot":
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
                asyncio.create_task(handle_query_ws(ws, cache, query))
            except Exception as e:
                logger.exception("Failed to schedule query task")
                ws.send({"type": "error", "error": str(e)}, OpCode.TEXT)
            return

        ws.send({"type": "error", "error": "invalid message"}, OpCode.TEXT)

    async def ws_message(ws, message, opcode):
        print(f"opcode: {opcode}")
        print(f"opcode == OpCode.BINARY: {opcode == OpCode.BINARY}")
        print(f"isinstance(message, str): {isinstance(message, str)}")
        print(f"isinstance(message, memoryview): {isinstance(message, memoryview)}")
        print(f"isinstance(message, (bytes, bytearray, memoryview)): {isinstance(message, (bytes, bytearray, memoryview))}")
        print(f"crdt_enabled: {crdt_enabled}")

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
                    print(f"calling _crdt_update with message_bytes len: {len(message_bytes)} bytes")
                    await _crdt_update(ws, message_bytes)
                except Exception as exc:
                    print(f"error calling _crdt_update: {exc}")
                    logger.exception("Failed to process CRDT binary message")
                    ws.send({"type": "error", "error": str(exc)}, OpCode.TEXT)
                return
            ws.send({"type": "error", "error": "binary not supported"}, OpCode.TEXT)
            return

        if isinstance(message, (bytes, bytearray, memoryview)):
            if crdt_enabled:
                print(f"message len: {len(message)} bytes")
                print(f"message.tobytes() len: {len(message.tobytes())} bytes")
                print(f"bytes(message) len: {len(bytes(message))} bytes")
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
            "compression": CompressOptions.SHARED_COMPRESSOR,
            "open": ws_open,
            "message": ws_message,
            "drain": lambda ws: logger.warning(
                f"WebSocket backpressure: {ws.get_buffered_amount()}"
            ),
            "close": lambda ws, code, message: (
                ws_rooms_by_peer.pop(_ws_key(ws), None),
                ws_rooms.pop(ws, None),
                ws_rooms_by_id.pop(id(ws), None),
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
