import logging
import sys
import time
from functools import partial
import asyncio
import json
import concurrent.futures

import ujson
from socketify import App, CompressOptions, OpCode
from .auth import AuthManager

from pkg.query import run_duckdb
from . import db_async

logger = logging.getLogger(__name__)

SLOW_QUERY_THRESHOLD = 5000


class Handler:
    def done(self):
        raise Exception("NotImplementedException")

    def arrow(self, _buffer):
        raise Exception("NotImplementedException")

    def json(self, _data):
        raise Exception("NotImplementedException")

    def error(self, _error):
        raise Exception("NotImplementedException")


class SocketHandler(Handler):
    def __init__(self, ws):
        self.ws = ws

    def check(self, ok):
        if not ok:
            logger.warning(f"WebSocket backpressure: {self.ws.get_buffered_amount()}")

    def done(self):
        ok = self.ws.send({}, OpCode.TEXT)
        self.check(ok)

    def arrow(self, buffer):
        ok = self.ws.send(buffer, OpCode.BINARY)
        self.check(ok)

    def json(self, data):
        ok = self.ws.send(data, OpCode.TEXT)
        self.check(ok)

    def error(self, error):
        ok = self.ws.send({"error": str(error)}, OpCode.TEXT)
        self.check(ok)


class HTTPHandler(Handler):
    def __init__(self, res):
        self.res = res

    def done(self):
        self.res.end("")

    def arrow(self, buffer):
        self.res.write_header("Content-Type", "application/octet-stream")
        self.res.end(buffer)

    def json(self, data):
        self.res.write_header("Content-Type", "application/json")
        self.res.end(data)

    def error(self, error):
        self.res.write_status(500)
        self.res.write_header("Content-Type", "application/json")
        try:
            body = ujson.dumps({"type": "error", "error": str(error)})
        except Exception:
            body = '{"type":"error","error":"internal"}'
        self.res.end(body)


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
            payload = _build_arrow_frame(query_id, result["data"])  # bytes
            _ws_send(ws, payload, OpCode.BINARY)
        elif rtype == "json":
            _ws_send(ws, {"type": "json", "queryId": query_id, "data": result["data"]}, OpCode.TEXT)
        elif rtype == "ok":
            _ws_send(ws, {"type": "ok", "queryId": query_id}, OpCode.TEXT)
        else:
            _ws_send(ws, {"type": "error", "queryId": query_id, "error": "Unexpected result type"}, OpCode.TEXT)
    except concurrent.futures.CancelledError:
        ws.send({"type": "error", "queryId": query_id, "error": "Query was cancelled"}, OpCode.TEXT)
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


def server(cache, port=4000, auth_token: str | None = None):
    # SSL server
    # app = App(AppOptions(key_file_name="./localhost-key.pem", cert_file_name="./localhost.pem"))
    app = App()

    # faster serialization than standard json
    app.json_serializer(ujson)

    # Auth helper
    auth = AuthManager(auth_token)

    def _http_unauthorized(res):
        res.write_status(401)
        # CORS headers for browsers
        res.write_header("Access-Control-Allow-Origin", "*")
        res.write_header("Access-Control-Request-Method", "*")
        res.write_header("Access-Control-Allow-Methods", "OPTIONS, POST, GET")
        res.write_header("Access-Control-Allow-Headers", "*")
        res.write_header("Access-Control-Max-Age", "2592000")
        res.write_header("Content-Type", "application/json")
        res.end('{"type":"error","error":"unauthorized"}')

    def _check_http_auth(req) -> bool:
        return auth.check_http(req)

    def ws_open(ws):
        auth.on_open(ws)

    def _process_message(ws, query):
        # Cancellation message: { type: 'cancel', queryId }
        if isinstance(query, dict) and query.get("type") == "cancel":
            qid = query.get("queryId")
            cancelled = False
            if qid:
                cancelled = db_async.cancel_query(qid)
            ws.send({"type": "cancelAck", "queryId": qid, "cancelled": bool(cancelled)}, OpCode.TEXT)
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
            payload = {"type": "notify", "channel": channel, "payload": query.get("payload")}
            if channel:
                app.publish(channel, ujson.dumps(payload))
                ws.send(payload, OpCode.TEXT)
                ws.send({"type": "notifyAck", "channel": channel}, OpCode.TEXT)
            else:
                ws.send({"type": "error", "error": "Missing channel"}, OpCode.TEXT)
            return

        # Query messages: only accept valid types with sql
        if isinstance(query, dict) and query.get("type") in ("arrow", "json", "exec") and isinstance(query.get("sql"), str):
            try:
                asyncio.create_task(handle_query_ws(ws, cache, query))
            except Exception as e:
                logger.exception("Failed to schedule query task")
                ws.send({"type": "error", "error": str(e)}, OpCode.TEXT)
            return

        ws.send({"type": "error", "error": "invalid message"}, OpCode.TEXT)

    def ws_message(ws, message, opcode):
        try:
            # Ensure text for JSON parse
            if isinstance(message, (bytes, bytearray, memoryview)):
                msg_str = bytes(message).decode("utf-8", "ignore")
            else:
                msg_str = message
            query = ujson.loads(msg_str)
        except Exception:
            ws.send({"type": "error", "error": "invalid json"}, OpCode.TEXT)
            return

        # Delegate auth handling; if it handled the message (auth/unauthorized), stop
        if auth.handle_ws_message(ws, query):
            return

        _process_message(ws, query)

    async def http_handler(res, req):
        method = req.get_method()

        # Handle preflight early
        if method == "OPTIONS":
            res.write_header("Access-Control-Allow-Origin", "*")
            res.write_header("Access-Control-Request-Method", "*")
            res.write_header("Access-Control-Allow-Methods", "OPTIONS, POST, GET")
            res.write_header("Access-Control-Allow-Headers", "*")
            res.write_header("Access-Control-Max-Age", "2592000")
            res.end("")
            return

        # Enforce auth before writing headers, so we can set status properly
        if method in ("GET", "POST") and not _check_http_auth(req):
            _http_unauthorized(res)
            return

        # Authorized path: add CORS headers then handle
        res.write_header("Access-Control-Allow-Origin", "*")
        res.write_header("Access-Control-Request-Method", "*")
        res.write_header("Access-Control-Allow-Methods", "OPTIONS, POST, GET")
        res.write_header("Access-Control-Allow-Headers", "*")
        res.write_header("Access-Control-Max-Age", "2592000")

        handler = HTTPHandler(res)

        if method == "GET":
            data = ujson.loads(req.get_query("query"))
            try:
                result = await run_duckdb(cache, data)
                rtype = result.get("type")
                if rtype == "arrow":
                    handler.arrow(result["data"])
                elif rtype == "json":
                    handler.json(result["data"])
                elif rtype == "ok":
                    handler.json(ujson.dumps({"type": "ok"}))
                else:
                    handler.error("Unexpected result type")
            except Exception as e:
                logger.exception("Error processing HTTP GET")
                handler.error(e)
        elif method == "POST":
            data = await res.get_json()
            try:
                result = await run_duckdb(cache, data)
                rtype = result.get("type")
                if rtype == "arrow":
                    handler.arrow(result["data"])
                elif rtype == "json":
                    handler.json(result["data"])
                elif rtype == "ok":
                    handler.json(ujson.dumps({"type": "ok"}))
                else:
                    handler.error("Unexpected result type")
            except Exception as e:
                logger.exception("Error processing HTTP POST")
                handler.error(e)

    app.ws(
        "/*",
        {
            "compression": CompressOptions.SHARED_COMPRESSOR,
            "open": ws_open,
            "message": ws_message,
            "drain": lambda ws: logger.warning(
                f"WebSocket backpressure: {ws.get_buffered_amount()}"
            ),
            "close": lambda ws, code, message: auth.on_close(ws),
        },
    )

    app.any("/", http_handler)

    app.set_error_handler(on_error)

    app.listen(
        port,
        lambda config: sys.stdout.write(
            f"DuckDB Server listening at ws://localhost:{config.port} and http://localhost:{config.port}\n"
        ),
    )
    app.run()
