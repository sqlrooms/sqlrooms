from __future__ import annotations

import asyncio
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
            name = str(raw.get("name") or "").strip()
            if not name:
                continue
            annotations = raw.get("annotations") or {}
            tools.append(
                types.Tool(
                    name=name,
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
        client_info = _client_info(context)
        request_id = str(getattr(context, "request_id", "") or "")
        started_at = time.monotonic()
        try:
            result = await self._request_with_disconnect(
                context,
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

    async def _request_with_disconnect(
        self,
        context: ServerRequestContext,
        method: str,
        params: Any,
    ) -> Any:
        request_task = asyncio.create_task(self.broker.request(method, params))
        request = getattr(context, "request", None)
        is_disconnected = getattr(request, "is_disconnected", None)
        if not callable(is_disconnected):
            return await request_task

        disconnect_task = asyncio.create_task(
            _wait_for_disconnect(is_disconnected, request_task)
        )
        try:
            done, _pending = await asyncio.wait(
                {request_task, disconnect_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if request_task in done:
                return request_task.result()
            if disconnect_task.result():
                request_task.cancel()
                await asyncio.gather(request_task, return_exceptions=True)
                raise McpBridgeError(
                    "cancelled",
                    "The MCP caller disconnected.",
                    retryable=True,
                )
            return await request_task
        finally:
            disconnect_task.cancel()
            await asyncio.gather(disconnect_task, return_exceptions=True)
            if not request_task.done():
                request_task.cancel()
                await asyncio.gather(request_task, return_exceptions=True)


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _client_info(context: ServerRequestContext) -> dict[str, str] | None:
    """Return identity observed during MCP initialization, never call metadata."""
    initialize = getattr(context.session, "client_params", None)
    raw = getattr(initialize, "client_info", None)
    if raw is None:
        return None
    identity = {
        key: str(value)
        for key, value in (
            ("name", getattr(raw, "name", None)),
            ("version", getattr(raw, "version", None)),
        )
        if value is not None
    }
    return identity or None


async def _wait_for_disconnect(is_disconnected, request_task: asyncio.Task) -> bool:
    while not request_task.done():
        try:
            if await is_disconnected():
                return True
        except Exception:
            return False
        await asyncio.sleep(0.1)
    return False
