import asyncio
from types import SimpleNamespace

import mcp.types as types
import pytest
from mcp import Client

from sqlrooms.web.mcp import SqlroomsMcpService
from sqlrooms.web.mcp_bridge import McpBridgeError


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
