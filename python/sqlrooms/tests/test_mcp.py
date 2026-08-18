import asyncio
from types import SimpleNamespace

import mcp.types as types
import pytest
from mcp import Client

from sqlrooms.web.mcp import SqlroomsMcpService
from sqlrooms.web.mcp_bridge import McpBridgeBroker, McpBridgeError


class StubBroker:
    def __init__(self):
        self.requests = []

    async def request(self, method, params=None):
        self.requests.append((method, params))
        if method == "tools.list":
            return [
                {"name": "", "description": "Invalid empty tool."},
                {
                    "name": "query",
                    "title": "Query",
                    "description": "Run SQL.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"sql": {"type": "string"}},
                        "required": ["sql"],
                    },
                    "annotations": {"readOnlyHint": True},
                },
            ]
        return {"ok": True, "data": {"echo": params}}


def test_mcp_bridge_status_reports_expired_lease_as_waiting(monkeypatch):
    monotonic_time = 10.0
    monkeypatch.setattr(
        "sqlrooms.web.mcp_bridge.time.monotonic", lambda: monotonic_time
    )
    broker = McpBridgeBroker("token", lease_timeout=5.0)
    broker._ready = True
    broker._touch()

    assert broker.status()["status"] == "ready"

    monotonic_time = 16.0

    assert broker.status()["status"] == "waiting"


@pytest.mark.asyncio
async def test_mcp_bridge_normalizes_send_disconnect_as_room_not_ready():
    class DisconnectedWebSocket:
        async def send_json(self, _payload):
            raise RuntimeError("websocket disconnected")

    broker = McpBridgeBroker("token")
    broker._connection = DisconnectedWebSocket()
    broker._ready = True
    broker._touch()

    with pytest.raises(McpBridgeError) as error:
        await broker.request("tools.list")

    assert error.value.code == "room_not_ready"
    assert error.value.retryable is True
    assert broker.status()["status"] == "waiting"
    assert broker._pending == {}


@pytest.mark.asyncio
async def test_mcp_service_adapts_dynamic_browser_catalog():
    service = SqlroomsMcpService(StubBroker())

    result = await service._list_tools(None, None)

    assert [tool.name for tool in result.tools] == ["query"]
    assert result.tools[0].input_schema["required"] == ["sql"]
    assert result.tools[0].annotations.read_only_hint is True
    assert result.ttl_ms == 1_000
    assert result.cache_scope == "private"


@pytest.mark.asyncio
async def test_mcp_service_serves_2026_protocol_with_official_client():
    broker = StubBroker()
    service = SqlroomsMcpService(broker)

    async with Client(
        service.server,
        client_info=types.Implementation(name="Codex", version="6.1"),
    ) as client:
        assert client.protocol_version == "2026-07-28"
        tools = await client.list_tools()
        result = await client.call_tool("query", {"sql": "select 1"})

    assert [tool.name for tool in tools.tools] == ["query"]
    assert result.is_error is False
    assert result.structured_content["ok"] is True
    call_params = next(
        params for method, params in broker.requests if method == "tools.call"
    )
    assert call_params["context"]["clientInfo"] == {
        "name": "Codex",
        "version": "6.1",
    }


@pytest.mark.asyncio
async def test_mcp_service_cancels_bridge_request_when_http_caller_disconnects():
    cancelled = asyncio.Event()

    class WaitingBroker:
        async def request(self, _method, _params=None):
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                cancelled.set()
                raise

    class DisconnectedRequest:
        async def is_disconnected(self):
            return True

    service = SqlroomsMcpService(WaitingBroker())
    context = SimpleNamespace(request=DisconnectedRequest())

    with pytest.raises(McpBridgeError, match="caller disconnected"):
        await service._request_with_disconnect(context, "tools.call", {})

    assert cancelled.is_set()
