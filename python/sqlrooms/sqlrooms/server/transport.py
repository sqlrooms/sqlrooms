"""Authenticated ASGI WebSocket delivery with bounded per-connection resources."""

from __future__ import annotations

import asyncio
from collections import deque
import json
import uuid

import anyio

from starlette.websockets import WebSocket, WebSocketDisconnect

from .access import AccessDenied
from .protocol import (
    OpCode,
    _parse_framed_binary,
    handle_query_ws,
    handle_upload_arrow_ws,
)

MAX_MESSAGE_BYTES = 128 * 1024 * 1024
MAX_OUTGOING_BYTES = 128 * 1024 * 1024
MAX_OUTGOING_MESSAGES = 64
MAX_PENDING_OPERATIONS = 32
MAX_PENDING_BYTES = 128 * 1024 * 1024
MAX_CONNECTIONS = 64
SEND_TIMEOUT = 15


class Connection:
    """A unique live connection, its tasks and its single sending coroutine."""

    def __init__(self, transport, websocket, token):
        self.transport = transport
        self.websocket = websocket
        self.token = token
        self.identity = str(uuid.uuid4())
        self.queue = deque()
        self.queued_bytes = 0  # Includes the frame currently being sent.
        self.outgoing_count = 0
        self.pending_bytes = 0
        self.pending = {}
        self.channels = set()
        self.wake = asyncio.Event()
        self.closed = False
        self.failure = None
        self.control_lock = asyncio.Lock()

    def authorized(self):
        if self.closed:
            return False
        try:
            self.transport.security.access.verify(self.token, "query")
            return True
        except AccessDenied:
            self.fail(1008, "authorization expired")
            return False

    def fail(self, code, reason):
        self.failure = (code, reason)
        self.closed = True
        self.queue.clear()
        self.wake.set()

    def send(self, payload, opcode=OpCode.TEXT):
        if not self.authorized():
            return False
        if opcode == OpCode.TEXT and not isinstance(payload, str):
            payload = json.dumps(payload)
        size = len(payload) if isinstance(payload, bytes) else len(payload.encode())
        if (
            self.queued_bytes + size > self.transport.max_outgoing_bytes
            or self.outgoing_count >= self.transport.max_outgoing_messages
        ):
            self.fail(1013, "slow client: outgoing queue limit exceeded")
            return False
        self.queue.append((payload, size))
        self.queued_bytes += size
        self.outgoing_count += 1
        self.wake.set()
        return True

    async def sender(self):
        try:
            while not self.closed:
                if not self.queue:
                    self.wake.clear()
                    await self.wake.wait()
                    continue
                payload, size = self.queue.popleft()
                if not self.authorized():
                    break
                send = (
                    self.websocket.send_bytes
                    if isinstance(payload, bytes)
                    else self.websocket.send_text
                )
                await asyncio.wait_for(send(payload), SEND_TIMEOUT)
                self.queued_bytes -= size
                self.outgoing_count -= 1
        except asyncio.TimeoutError:
            self.fail(1013, "slow client: send timed out")
        finally:
            if self.failure:
                await self.websocket.close(code=self.failure[0], reason=self.failure[1])

    def unsubscribe(self, channel):
        self.channels.discard(channel)

    def subscribe(self, channel):
        if len(self.channels) >= 128:
            raise ValueError("Too many subscriptions")
        self.channels.add(channel)

    def start(self, query_id, size, operation):
        if (
            query_id in self.pending
            or len(self.pending) >= MAX_PENDING_OPERATIONS
            or self.pending_bytes + size > MAX_PENDING_BYTES
        ):
            self.send(
                {
                    "type": "error",
                    "queryId": query_id,
                    "error": "Duplicate queryId or connection busy",
                }
            )
            return
        operation_id = self.identity + ":" + query_id
        self.pending_bytes += size

        async def run():
            try:
                if self.authorized():
                    await operation(operation_id)
            except asyncio.CancelledError:
                self.send(
                    {
                        "type": "error",
                        "queryId": query_id,
                        "error": "Query was cancelled",
                    }
                )
            except Exception as exc:
                self.send({"type": "error", "queryId": query_id, "error": str(exc)})

        task = asyncio.create_task(run())
        self.pending[query_id] = task

        def finished(_task):
            if _task.cancelled():
                self.send(
                    {
                        "type": "error",
                        "queryId": query_id,
                        "error": "Query was cancelled",
                    }
                )
            self.pending.pop(query_id, None)
            self.pending_bytes -= size

        task.add_done_callback(finished)

    async def cleanup(self):
        self.closed = True
        self.queue.clear()
        self.queued_bytes = 0
        self.outgoing_count = 0
        self.channels.clear()
        tasks = list(self.pending.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if self.transport.crdt:
            self.transport.crdt.unregister_conn(self.identity)
        self.transport.connections.discard(self)


class DuckDBTransport:
    """One transport hub per runtime; slow subscribers fail independently."""

    def __init__(
        self,
        runtime,
        security,
        *,
        max_outgoing_bytes=MAX_OUTGOING_BYTES,
        max_outgoing_messages=MAX_OUTGOING_MESSAGES,
    ):
        self.runtime = runtime
        self.security = security
        self.connections = set()
        self.admitted = 0
        self.crdt = None
        self.closing = False
        self.max_outgoing_bytes = max_outgoing_bytes
        self.max_outgoing_messages = max_outgoing_messages

    def publish(self, channel, payload, opcode=OpCode.TEXT):
        for connection in tuple(self.connections):
            if channel in connection.channels:
                connection.send(payload, opcode)

    async def handle(self, websocket: WebSocket):
        if self.closing or not self.runtime.ready or self.admitted >= MAX_CONNECTIONS:
            await websocket.close(code=1013, reason="database unavailable or busy")
            return
        self.admitted += 1
        try:
            result = await self.security.authenticate_socket(websocket, "query")
            if result is None:
                self.admitted -= 1
                return
        except BaseException:
            self.admitted -= 1
            raise
        if self.closing:
            self.admitted -= 1
            await websocket.close(code=1013, reason="workspace closing")
            return
        connection = Connection(self, websocket, result[0])
        self.connections.add(connection)
        connection.send({"type": "authAck"})
        tasks = [
            asyncio.create_task(connection.sender()),
            asyncio.create_task(self.receive(connection)),
            asyncio.create_task(self.watch(connection)),
        ]
        try:
            done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                task.result()
        except (asyncio.CancelledError, WebSocketDisconnect, RuntimeError):
            pass
        finally:
            for task in tasks:
                task.cancel()
            with anyio.CancelScope(shield=True):
                await asyncio.gather(*tasks, return_exceptions=True)
                try:
                    await connection.cleanup()
                finally:
                    self.admitted -= 1

    async def watch(self, connection):
        while not connection.closed:
            await asyncio.sleep(1)
            connection.authorized()
        connection.wake.set()
        # Let the sole sender deliver the close frame.
        await asyncio.Event().wait()

    async def receive(self, connection):
        while not connection.closed:
            message = await connection.websocket.receive()
            if message["type"] == "websocket.disconnect":
                return
            if not connection.authorized():
                continue
            data = message.get("bytes")
            raw = data if data is not None else message.get("text", "")
            size = len(raw) if isinstance(raw, bytes) else len(raw.encode())
            if size > MAX_MESSAGE_BYTES:
                connection.fail(1009, "message too large")
                return await asyncio.Event().wait()
            if self.closing:
                connection.send({"type": "error", "error": "Workspace is closing"})
                continue
            try:
                if data is not None:
                    parsed = _parse_framed_binary(data)
                    if (
                        parsed
                        and isinstance(parsed[0], dict)
                        and parsed[0].get("type") == "uploadArrow"
                    ):
                        header, payload = parsed
                        qid = self.query_id(header)
                        connection.start(
                            qid,
                            size,
                            lambda op, h=header, p=payload: handle_upload_arrow_ws(
                                self.runtime, connection, h, p, op
                            ),
                        )
                    elif self.crdt:

                        async def update(_op, payload=data):
                            async with connection.control_lock:
                                await self.crdt.handle_binary_update(
                                    connection,
                                    conn_id=connection.identity,
                                    payload=payload,
                                )

                        connection.start(str(uuid.uuid4()), size, update)
                    else:
                        connection.send(
                            {"type": "error", "error": "binary not supported"}
                        )
                    continue
                query = json.loads(raw)
                if not isinstance(query, dict):
                    raise ValueError("invalid message")
                kind = query.get("type")
                if kind == "auth":
                    if query.get("token") != connection.token:
                        raise AccessDenied()
                    connection.send({"type": "authAck"})
                elif kind == "cancel":
                    qid = self.query_id(query)
                    task = connection.pending.get(qid)
                    if task:
                        task.cancel()
                    connection.send(
                        {
                            "type": "cancelAck",
                            "queryId": qid,
                            "cancelled": task is not None,
                        }
                    )
                elif kind in {"subscribe", "notify"}:
                    channel = query.get("channel")
                    if (
                        not isinstance(channel, str)
                        or not channel
                        or len(channel) > 255
                        or channel.startswith("__conn:")
                    ):
                        raise ValueError("Invalid channel")
                    if kind == "subscribe":
                        connection.subscribe(channel)
                        connection.send({"type": "subscribed", "channel": channel})
                    else:
                        payload = {
                            "type": "notify",
                            "channel": channel,
                            "payload": query.get("payload"),
                        }
                        self.publish(channel, payload)
                        connection.send(payload)
                        connection.send({"type": "notifyAck", "channel": channel})
                elif kind in {"json", "arrow", "exec"} and isinstance(
                    query.get("sql"), str
                ):
                    qid = self.query_id(query)
                    connection.start(
                        qid,
                        size,
                        lambda op, q=query: handle_query_ws(
                            self.runtime, connection.send, q, op
                        ),
                    )
                elif self.crdt and kind in {"crdt-join", "crdt-snapshot"}:

                    async def sync(_op, q=query):
                        async with connection.control_lock:
                            await self.crdt.maybe_handle_json(
                                connection, conn_id=connection.identity, message=q
                            )

                    connection.start(str(uuid.uuid4()), size, sync)
                else:
                    raise ValueError("invalid message")
            except AccessDenied:
                connection.fail(1008, "unauthorized")
            except (ValueError, TypeError) as exc:
                connection.send({"type": "error", "error": str(exc)})

    @staticmethod
    def query_id(query):
        qid = query.get("queryId") or str(uuid.uuid4())
        if not isinstance(qid, str) or len(qid) > 256:
            raise ValueError("Invalid queryId")
        query["queryId"] = qid
        return qid

    async def drain(self):
        """Stop admission and settle each connection's pending operations."""
        self.closing = True
        tasks = [task for c in tuple(self.connections) for task in c.pending.values()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
