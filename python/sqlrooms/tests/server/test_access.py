"""Connection-owned delivery never targets a replacement or revoked caller."""

import asyncio
from types import SimpleNamespace

import pytest
from sqlrooms.server.access import LocalAccess
from sqlrooms.server.security import TransportSecurity
from sqlrooms.server.transport import Connection, DuckDBTransport
from sqlrooms.server.protocol import OpCode, handle_upload_arrow_ws


class Socket:
    def __init__(self):
        self.messages = []
        self.closed = None

    async def send_text(self, value):
        self.messages.append(value)

    async def send_bytes(self, value):
        self.messages.append(value)

    async def close(self, code, reason):
        self.closed = code


def connection(*, budget=128, count=4, clock=None):
    access = LocalAccess(**({"clock": clock} if clock else {}))
    transport = DuckDBTransport(
        None,
        TransportSecurity(access, set(), set()),
        max_outgoing_bytes=budget,
        max_outgoing_messages=count,
    )
    result = Connection(transport, Socket(), access.native_token)
    transport.connections.add(result)
    return result, access


@pytest.mark.asyncio
async def test_delayed_result_after_close_never_reaches_replacement():
    first, access = connection()
    replacement = Connection(first.transport, Socket(), access.native_token)
    await first.cleanup()
    assert not first.send({"type": "json", "data": "private"})
    assert not replacement.queue
    assert first.identity != replacement.identity


@pytest.mark.asyncio
async def test_queued_result_rechecks_revocation_before_send():
    conn, access = connection()
    assert conn.send({"type": "json", "data": "private"})
    access.revoke(conn.token)
    await conn.sender()
    assert conn.websocket.messages == []
    assert conn.websocket.closed == 1008
    await conn.cleanup()
    assert conn.queued_bytes == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("bytes_limit,count", [(5, 10), (100, 1)])
async def test_byte_and_count_overflow_close_without_silent_drop(bytes_limit, count):
    conn, _ = connection(budget=bytes_limit, count=count)
    conn.send(b"12345", OpCode.BINARY)
    assert not conn.send(b"1", OpCode.BINARY)
    await conn.sender()
    assert conn.websocket.closed == 1013
    await conn.cleanup()
    assert conn.queued_bytes == 0


@pytest.mark.asyncio
async def test_inflight_frame_counts_against_byte_budget():
    conn, _ = connection(budget=10)
    entered = asyncio.Event()

    async def slow(_):
        entered.set()
        await asyncio.Event().wait()

    conn.websocket.send_bytes = slow
    conn.send(b"12345678", OpCode.BINARY)
    sender = asyncio.create_task(conn.sender())
    await entered.wait()
    assert not conn.send(b"123", OpCode.BINARY)
    sender.cancel()
    await asyncio.gather(sender, return_exceptions=True)
    await conn.cleanup()


@pytest.mark.asyncio
async def test_slow_subscriber_does_not_block_other_delivery():
    slow, access = connection(budget=20)
    fast = Connection(slow.transport, Socket(), access.native_token)
    slow.transport.connections.add(fast)
    slow.subscribe("room")
    fast.subscribe("room")
    slow.send(b"x" * 20, OpCode.BINARY)
    slow.transport.publish("room", b"update", OpCode.BINARY)
    assert slow.failure[0] == 1013
    assert list(fast.queue) == [(b"update", 6)]
    await slow.cleanup()
    await fast.cleanup()


@pytest.mark.asyncio
async def test_upload_revoked_during_execution_never_delivers_ack():
    conn, access = connection()

    async def execute(*args, **kwargs):
        access.revoke(conn.token)

    await handle_upload_arrow_ws(
        SimpleNamespace(run_db_task=execute),
        conn,
        {"tableName": "safe", "queryId": "q"},
        b"payload",
        "op",
    )
    assert not conn.queue
    assert conn.failure[0] == 1008


@pytest.mark.asyncio
async def test_cancel_before_task_starts_releases_pending_payload():
    conn, _ = connection()

    async def work(_):
        pytest.fail("cancelled work ran")

    conn.start("early", 50, work)
    conn.pending["early"].cancel()
    await asyncio.gather(*conn.pending.values(), return_exceptions=True)
    assert conn.pending == {}
    assert conn.pending_bytes == 0


@pytest.mark.asyncio
async def test_connection_limit_includes_incomplete_authentication(monkeypatch):
    import sqlrooms.server.transport as module

    monkeypatch.setattr(module, "MAX_CONNECTIONS", 1)
    started = asyncio.Event()

    async def authenticate(*args):
        started.set()
        await asyncio.Event().wait()

    transport = DuckDBTransport(
        SimpleNamespace(ready=True), SimpleNamespace(authenticate_socket=authenticate)
    )
    first = asyncio.create_task(transport.handle(Socket()))
    await started.wait()
    second = Socket()
    await transport.handle(second)
    assert second.closed == 1013
    assert transport.admitted == 1
    first.cancel()
    await asyncio.gather(first, return_exceptions=True)
    assert transport.admitted == 0
