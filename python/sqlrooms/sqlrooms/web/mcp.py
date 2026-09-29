from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Mapping
from typing import Any

import mcp.types as types
from mcp.server import Server, ServerRequestContext

from .mcp_bridge import McpBridgeBroker, McpBridgeError
from .security import McpAuthorization, TransportSecurity

logger = logging.getLogger(__name__)


class SqlroomsMcpService:
    """Official MCP SDK adapter for the live browser capability catalog."""

    def __init__(
        self, broker: McpBridgeBroker, *, security: TransportSecurity, name="SQLRooms"
    ):
        self.name = name
        self.broker = broker
        self.enabled = False
        self.server = Server(
            name,
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

        self.sdk_app = self.app
        self.app = McpAuthorization(self.app, security)

    async def __call__(self, scope, receive, send):
        """Serve the existing SDK path without a mount prefix or extra listener."""
        if not self.enabled:
            from starlette.responses import JSONResponse

            await JSONResponse({"error": "mcp_disabled"}, status_code=503)(
                scope, receive, send
            )
            return
        await self.app(scope, receive, send)

    def lifespan(self):
        """Start the SDK session manager on the parent application's event loop."""
        return self.sdk_app.router.lifespan_context(self.sdk_app)

    async def _list_tools(
        self,
        _context: ServerRequestContext,
        _params: types.PaginatedRequestParams | None,
    ) -> types.ListToolsResult:
        try:
            raw_tools = await self.broker.request("tools.list")
        except McpBridgeError as exc:
            if exc.code != "room_not_ready":
                raise
            logger.debug("MCP tool discovery waiting for browser bridge")
            raw_tools = []
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
            result = await self._dispatch(
                context,
                params,
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
                "message": f"The {self.name} page returned an invalid result.",
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

    async def _dispatch(self, context, params, method, payload):
        runtime = getattr(self.broker, "agent_runtime", None)
        if runtime:
            if runtime.stopping:
                return {
                    "ok": False,
                    "code": "workspace_busy",
                    "message": "Workspace is closing.",
                }
            # Admission and close's idle check run on the same event loop with no
            # intervening await. Retained operations cover response disconnects.
            runtime.active_calls += 1
        try:
            return await self._dispatch_admitted(context, params, method, payload)
        finally:
            if runtime:
                runtime.active_calls -= 1

    async def _dispatch_admitted(self, context, params, method, payload):
        from ..agent.storage import WorkspaceError
        from ..agent.contract import matches_browser

        runtime = getattr(self.broker, "agent_runtime", None)
        meta = params.meta or {}
        operation_id = meta.get("sqlrooms/operationId")
        if runtime and runtime.stopping:
            return {
                "ok": False,
                "code": "workspace_busy",
                "message": "Workspace is closing.",
            }
        if not operation_id or runtime is None:
            return await self._request_with_disconnect(context, method, payload)
        caller = getattr(
            getattr(context.request, "state", None), "sqlrooms_caller", None
        )
        if caller is None:
            return {
                "ok": False,
                "code": "unauthorized",
                "message": "Verified caller required.",
            }
        if runtime.stopping:
            return {
                "ok": False,
                "code": "workspace_busy",
                "message": "Workspace is closing.",
            }

        async def invoke():
            if not matches_browser(
                await self.broker.request("tools.list"),
                contract=runtime.settings.contract,
            ):
                return {
                    "ok": False,
                    "code": "incompatible_runtime",
                    "message": "Reload the browser to use this tool contract.",
                }
            return await self.broker.request(method, payload)

        try:
            return await runtime.operations.run(caller, operation_id, invoke)
        except WorkspaceError as exc:
            return exc.result

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
    """Return SDK-managed protocol identity, never tool-call arguments."""
    meta = getattr(context, "meta", None)
    raw = meta.get(types.CLIENT_INFO_META_KEY) if isinstance(meta, Mapping) else None
    if raw is None:
        initialize = getattr(context.session, "client_params", None)
        raw = getattr(initialize, "client_info", None)
    if raw is None:
        return None

    def get_value(key: str) -> Any:
        return raw.get(key) if isinstance(raw, Mapping) else getattr(raw, key, None)

    identity = {
        key: str(value)
        for key, value in (
            ("name", get_value("name")),
            ("version", get_value("version")),
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
