import pytest
from mcp import Client

from sqlrooms.web.mcp import SqlroomsMcpService


class StubBroker:
    async def request(self, method, params=None):
        if method == "tools.list":
            return [
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
                }
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
    service = SqlroomsMcpService(StubBroker())

    async with Client(service.server) as client:
        assert client.protocol_version == "2026-07-28"
        tools = await client.list_tools()
        result = await client.call_tool("query", {"sql": "select 1"})

    assert [tool.name for tool in tools.tools] == ["query"]
    assert result.is_error is False
    assert result.structured_content["ok"] is True
