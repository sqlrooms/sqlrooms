"""Stable stdio MCP surface; each live call carries an explicit instance target."""

from __future__ import annotations

import asyncio
import copy
import json
import time
import uuid

import httpx
import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from .contract import CONTRACT
from .manager import Manager
from .catalog import Catalog
from .settings import ApplicationSettings
from . import registry
from .storage import WorkspaceError


def tool(name, description, properties, required=()):
    return {
        "name": name,
        "description": description,
        "inputSchema": {
            "type": "object",
            "properties": properties,
            "required": list(required),
            "additionalProperties": False,
        },
    }


STRING = {"type": "string", "minLength": 1}
LIFECYCLE_TOOLS = [
    tool(
        "list_workspaces",
        "List saved, unavailable, running, and temporary workspaces. Choose explicitly when several targets are plausible.",
        {
            "status": {"enum": ["running"]},
            "refresh": {"type": "boolean"},
            "offset": {"type": "integer", "minimum": 0},
            "limit": {"type": "integer", "minimum": 1, "maximum": 200},
        },
    ),
    tool(
        "open_workspace",
        "Open exactly one saved workspaceId, explicit path, or create request. New workspaces default to document-charts-maps; dashboards need default. Returns instanceId for every live tool call. Does not grant query approval.",
        {
            "workspaceId": STRING,
            "path": STRING,
            "create": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "minLength": 1, "maxLength": 200}
                },
                "additionalProperties": False,
            },
            "profile": {"enum": ["default", "experimental", "document-charts-maps"]},
            "openBrowser": {"type": "boolean", "default": True},
        },
    ),
    tool(
        "close_workspace",
        "Flush the owning browser and gracefully stop an explicitly targeted managed instance. Never deletes files or closes a manual process.",
        {"instanceId": STRING},
        ["instanceId"],
    ),
    tool(
        "locate_workspace",
        "After user confirmation, relocate a missing catalog entry while preserving its ID. Cannot prove the replacement is the same file; cannot relocate live entries.",
        {"workspaceId": STRING, "path": STRING, "confirmed": {"type": "boolean"}},
        ["workspaceId", "path", "confirmed"],
    ),
    tool(
        "forget_workspace",
        "Forget history only on explicit request. Keeps files and servers; managed-folder and live discovery still apply.",
        {"workspaceId": STRING},
        ["workspaceId"],
    ),
]


def tools(settings=None):
    result = copy.deepcopy(LIFECYCLE_TOOLS)
    if settings and not settings.profiles:
        result[1]["inputSchema"]["properties"].pop("profile")
        result[1]["description"] = (
            "Open one workspaceId, explicit path, or create request. Returns instanceId for every live call; keep the owning browser open."
        )
    for shared in (settings.contract if settings else CONTRACT)["tools"]:
        item = copy.deepcopy(shared)
        item["inputSchema"]["properties"]["instanceId"] = STRING
        item["inputSchema"].setdefault("required", []).append("instanceId")
        result.append(item)
    return result


def result(value):
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=json.dumps(value, default=str))],
        structured_content=value,
        is_error=value.get("ok") is not True,
    )


class Connector:
    def __init__(self, *, settings: ApplicationSettings | None = None):
        self.settings = settings or ApplicationSettings()
        self.manager = Manager(Catalog(self.settings))
        self.sessions = {}
        self.server = Server(
            self.settings.name,
            instructions="Use list_workspaces and open_workspace before live tools. Carry the returned instanceId on every call. The owning browser must remain open; database writes and external or unverified reads require per-request browser approval. Discover commands before promising functionality. Never replay a mutation after timeout or cancellation.",
            on_list_tools=self.list_tools,
            on_call_tool=self.call_tool,
        )

    async def list_tools(self, context, params):
        return types.ListToolsResult(
            tools=[types.Tool.model_validate(t) for t in tools(self.settings)]
        )

    async def call_tool(self, context, params):
        try:
            import jsonschema

            definition = next(
                (t for t in tools(self.settings) if t["name"] == params.name), None
            )
            if definition is None:
                raise WorkspaceError("unknown_tool", "Unknown SQLRooms tool.")
            arguments = params.arguments or {}
            if params.name in {
                tool["name"] for tool in self.settings.contract["tools"]
            } and not arguments.get("instanceId"):
                raise WorkspaceError(
                    "missing_target",
                    "Open a workspace and supply its instanceId on every live tool call.",
                )
            jsonschema.validate(arguments, definition["inputSchema"])
            handlers = {
                "list_workspaces": self.manager.list,
                "open_workspace": self.manager.open,
                "close_workspace": self.manager.close,
                "locate_workspace": self.manager.locate,
                "forget_workspace": lambda workspaceId: self.manager.catalog.forget(
                    workspaceId
                ),
            }
            if params.name in handlers:
                value = await asyncio.to_thread(handlers[params.name], **arguments)
            else:
                value = await self.forward(params.name, arguments, context=context)
            return result(value)
        except WorkspaceError as exc:
            return result(exc.result)
        except OSError:
            return result(
                {
                    "ok": False,
                    "code": "workspace_io_error",
                    "message": "Workspace storage or process startup failed. Check permissions and available disk space.",
                }
            )
        except (ValueError, TypeError, jsonschema.ValidationError):
            return result(
                {
                    "ok": False,
                    "code": "invalid_input",
                    "message": "Arguments do not match this tool's schema.",
                }
            )

    async def forward(self, name, arguments, *, context=None):
        arguments = dict(arguments)
        instance_id = arguments.pop("instanceId")
        record, status = await asyncio.to_thread(
            self.manager.target, instance_id, tools=True, control=True
        )
        if not status["mcpEnabled"] or status["readiness"] != "ready":
            raise WorkspaceError(
                "room_not_ready",
                "Open the owning browser page and wait for readiness.",
                instanceId=instance_id,
            )
        auth = registry.credential(record)
        cached = self.sessions.get(instance_id)
        if cached is None or time.monotonic() - cached[1] > 3500:
            session = await asyncio.to_thread(
                registry.request, record, "/api/agent/session", payload={}
            )
            cached = (session["token"], time.monotonic())
            self.sessions[instance_id] = cached
        token = cached[0]
        operation_id = str(uuid.uuid4())
        headers = {
            "Authorization": "Bearer " + token,
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": types.LATEST_PROTOCOL_VERSION,
            "Mcp-Method": "tools/call",
            "Mcp-Name": name,
        }
        try:
            async with httpx.AsyncClient(trust_env=False, timeout=40) as client:
                response = await client.post(
                    auth["mcpUrl"],
                    headers=headers,
                    json={
                        "jsonrpc": "2.0",
                        "id": operation_id,
                        "method": "tools/call",
                        "params": {
                            "name": name,
                            "arguments": arguments,
                            "_meta": {
                                "sqlrooms/operationId": operation_id,
                                types.PROTOCOL_VERSION_META_KEY: types.LATEST_PROTOCOL_VERSION,
                                types.CLIENT_CAPABILITIES_META_KEY: {},
                                types.CLIENT_INFO_META_KEY: {
                                    "name": self.settings.name + " connector",
                                    "version": "1",
                                },
                            },
                        },
                    },
                )
                response.raise_for_status()
                payload = response.json()
            if "error" in payload:
                raise WorkspaceError(
                    "mcp_error",
                    "The runtime rejected the call.",
                    instanceId=instance_id,
                    operationId=operation_id,
                )
            value = payload["result"].get("structuredContent")
            if not isinstance(value, dict):
                raise WorkspaceError(
                    "invalid_bridge_result", "Runtime returned an invalid result."
                )
            return value
        except asyncio.CancelledError:
            # SDK cancellation is an explicit control action. Ordinary response
            # loss does not cancel or replay the downstream mutation.
            import anyio

            with anyio.CancelScope(shield=True):
                if not explicit_cancellation(context):
                    raise
                await asyncio.to_thread(
                    registry.request,
                    record,
                    "/api/agent/cancel",
                    payload={"operationId": operation_id},
                    token=token,
                )
            raise
        except (httpx.HTTPError, KeyError, ValueError):
            raise WorkspaceError(
                "operation_outcome_uncertain",
                "Response lost. Do not replay this operation; inspect the workspace before proceeding.",
                instanceId=instance_id,
                operationId=operation_id,
            ) from None

    async def run(self):
        async with stdio_server() as (read, write):
            await self.server.run(
                read, write, self.server.create_initialization_options()
            )


def explicit_cancellation(context) -> bool:
    """MCP 2.x adapter: distinguish peer cancel from SDK teardown on stream EOF.

    The low-level ServerRequestContext does not expose BaseContext's public
    cancel_requested event yet. Keep this version-sensitive access isolated and
    covered by real SDK stream tests. Missing support must never infer consent.
    """
    outbound = getattr(getattr(context, "session", None), "_request_outbound", None)
    signal = getattr(outbound, "cancel_requested", None)
    return signal is not None and signal.is_set()
