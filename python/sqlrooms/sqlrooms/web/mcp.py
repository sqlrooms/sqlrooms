from __future__ import annotations

import json
import logging
import time
from typing import Any

import mcp.types as types
from mcp.server import Server, ServerRequestContext

from .mcp_bridge import McpBridgeBroker, McpBridgeError

logger = logging.getLogger(__name__)


class SqlroomsMcpService:
    """Official MCP SDK adapter for the live browser capability catalog."""

    def __init__(self, broker: McpBridgeBroker):
        self.broker = broker
        self.server = Server(
            "SQLRooms",
            on_list_tools=self._list_tools,
            on_call_tool=self._call_tool,
        )
        self.app = self.server.streamable_http_app(
            streamable_http_path="/mcp",
            stateless_http=True,
            json_response=True,
            host="127.0.0.1",
            max_request_body_size=256 * 1024,
        )

    async def _list_tools(
        self,
        _context: ServerRequestContext,
        _params: types.PaginatedRequestParams | None,
    ) -> types.ListToolsResult:
        raw_tools = await self.broker.request("tools.list")
        tools = []
        for raw in raw_tools if isinstance(raw_tools, list) else []:
            if not isinstance(raw, dict):
                continue
            annotations = raw.get("annotations") or {}
            tools.append(
                types.Tool(
                    name=str(raw.get("name") or ""),
                    title=_optional_string(raw.get("title")),
                    description=_optional_string(raw.get("description")),
                    input_schema=raw.get("inputSchema") or {"type": "object"},
                    annotations=types.ToolAnnotations(
                        read_only_hint=annotations.get("readOnlyHint"),
                        idempotent_hint=annotations.get("idempotentHint"),
                        destructive_hint=annotations.get("destructiveHint"),
                    ),
                )
            )
        return types.ListToolsResult(
            tools=tools,
            ttl_ms=1_000,
            cache_scope="private",
        )

    async def _call_tool(
        self,
        context: ServerRequestContext,
        params: types.CallToolRequestParams,
    ) -> types.CallToolResult:
        client_info = _client_info(params)
        request_id = str(getattr(context, "request_id", "") or "")
        started_at = time.monotonic()
        try:
            result = await self.broker.request(
                "tools.call",
                {
                    "name": params.name,
                    "input": params.arguments or {},
                    "context": {
                        "surface": "mcp-http",
                        "requestId": request_id,
                        "traceId": request_id,
                        "clientInfo": client_info,
                    },
                },
            )
        except McpBridgeError as exc:
            result = {
                "ok": False,
                "code": exc.code,
                "message": str(exc),
                "retryable": exc.retryable,
            }

        if not isinstance(result, dict):
            result = {
                "ok": False,
                "code": "invalid_bridge_result",
                "message": "The SQLRooms page returned an invalid result.",
            }
        is_error = result.get("ok") is not True
        logger.debug(
            "MCP tool call tool=%s request=%s duration_ms=%d code=%s",
            params.name,
            request_id,
            int((time.monotonic() - started_at) * 1000),
            result.get("code") or ("ok" if not is_error else "error"),
        )
        return types.CallToolResult(
            content=[
                types.TextContent(
                    type="text",
                    text=json.dumps(result, separators=(",", ":"), default=str),
                )
            ],
            structured_content=result,
            is_error=is_error,
        )


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _client_info(params: types.CallToolRequestParams) -> dict[str, str] | None:
    meta = getattr(params, "meta", None) or getattr(params, "_meta", None)
    if not isinstance(meta, dict):
        try:
            meta = meta.model_dump(by_alias=True) if meta is not None else {}
        except Exception:
            meta = {}
    raw = meta.get("io.modelcontextprotocol/clientInfo") or meta.get("clientInfo")
    if not isinstance(raw, dict):
        return None
    return {
        key: str(raw[key]) for key in ("name", "version") if raw.get(key) is not None
    }
