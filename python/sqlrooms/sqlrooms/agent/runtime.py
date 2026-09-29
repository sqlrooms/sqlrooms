"""Authenticated lifecycle endpoints attached to the existing CLI server."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import time

from fastapi import Request
from fastapi.responses import JSONResponse

from .catalog import Catalog
from .contract import CONTROL_VERSION, TOOL_HASH, TOOL_VERSION
from .operations import Operations
from . import registry
from .storage import WorkspaceError


class Runtime:
    def __init__(self, server):
        self.server = server
        self._catalog = None
        self.workspace = None
        self.operations = Operations()
        self.managed = os.environ.get("SQLROOMS_MANAGED") == "1"
        self.started = time.time()
        self.stopping = False
        self.close_failed = False
        self.active_calls = 0
        self.browser_opened_at = 0.0
        self.browser_lock = asyncio.Lock()
        self.sessions = []

    @property
    def catalog(self):
        from ..web.security import supports_private_credentials

        if not supports_private_credentials():
            raise WorkspaceError(
                "unsupported_platform",
                "Managed workspace history requires tested owner-only storage, which is not yet available on this platform.",
            )
        if self._catalog is None:
            self._catalog = Catalog()
        return self._catalog

    def identity(self):
        s = self.server
        mcp = s._mcp_status()
        return {
            "instanceId": s.access.binding,
            "workspaceId": self.workspace["workspaceId"] if self.workspace else None,
            "name": self.workspace["name"] if self.workspace else None,
            "databasePath": s.duckdb_database,
            "profile": s.capability_profile,
            "executionMode": s.execution_mode,
            "embeddedAiEnabled": s.execution_mode == "embedded",
            "ownership": "managed" if self.managed else "manual",
            "apiUrl": s._ui_url(),
            "browserUrl": s.external_url or s._ui_url() if s.serve_ui else None,
            "mcpEnabled": mcp["enabled"],
            "mcpUrl": s._mcp_url() if mcp["enabled"] else None,
            "toolVersion": TOOL_VERSION,
            "toolHash": TOOL_HASH,
            "controlVersion": CONTROL_VERSION,
            "lifecycle": "stopping" if self.stopping else "running",
            "readiness": "ready"
            if mcp["enabled"] and mcp["bridge"]["status"] == "ready"
            else "waiting_for_browser"
            if mcp["enabled"]
            else "mcp_unavailable",
            "startedAt": self.started,
        }

    async def publish(self):
        s = self.server
        self.workspace = await asyncio.to_thread(
            self.catalog.register,
            s.duckdb_database,
            profile=s.capability_profile,
            opened=True,
        )
        registry.publish(
            {
                **self.identity(),
                "pid": os.getpid(),
                "processMarker": registry.process_marker(os.getpid()),
                "credentialFile": str(s.credential_file.path),
            }
        )

    def routes(self, app):
        s = self.server

        @app.exception_handler(WorkspaceError)
        async def workspace_error(_request, exc):
            return JSONResponse(exc.result)

        def authorize(request, operation="control", *, native=False):
            caller = s.security.authorize(request.headers, operation)
            if native and caller.kind not in {"native", "connector"}:
                from sqlrooms.server.access import AccessDenied

                raise AccessDenied("forbidden")
            return caller

        @app.get("/api/agent/identity")
        async def identity(request: Request):
            authorize(request, "read")
            return self.identity()

        @app.post("/api/agent/session")
        async def session(request: Request):
            caller = authorize(request, native=True)
            if caller.kind != "native":
                raise WorkspaceError(
                    "forbidden",
                    "Only a native handoff can create connector credentials.",
                )
            now = time.monotonic()
            self.sessions = [(t, at) for t, at in self.sessions if now - at < 3600]
            if len(self.sessions) >= 128:
                raise WorkspaceError(
                    "sessions_busy",
                    "Too many connector sessions; restart unused connectors.",
                )
            token = s.access.issue(
                "connector", frozenset({"read", "control", "mcp", "bootstrap"}), 3600
            )
            self.sessions.append((token, now))
            return {"token": token, "instanceId": s.access.binding}

        @app.post("/api/agent/cancel")
        async def cancel(request: Request):
            caller = authorize(request, native=True)
            body = await request.json()
            return self.operations.cancel(caller, body.get("operationId"))

        @app.post("/api/agent/operation")
        async def operation(request: Request):
            caller = authorize(request, native=True)
            body = await request.json()
            return self.operations.status(caller, body.get("operationId"))

        @app.post("/api/agent/browser")
        async def browser(request: Request):
            authorize(request, "bootstrap", native=True)
            async with self.browser_lock:
                if self.stopping:
                    raise WorkspaceError("workspace_busy", "Workspace is closing.")
                status = self.identity()
                body = await request.json()
                if not s.serve_ui:
                    raise WorkspaceError(
                        "ui_unavailable", "This server was started without a UI."
                    )
                # A recovery link is a short-lived, single-use ticket, never a
                # reusable credential. It is returned only to an authorized opener.
                launch_url = (
                    s._launch_url()
                    if status["readiness"] != "ready"
                    else status["browserUrl"]
                )
                if (
                    body.get("openBrowser", True)
                    and status["readiness"] != "ready"
                    and time.monotonic() - self.browser_opened_at > 15
                ):
                    self.browser_opened_at = time.monotonic()
                    import webbrowser

                    try:
                        opened = await asyncio.to_thread(webbrowser.open, launch_url)
                    except Exception:
                        opened = False
                    status["browserOpened"] = opened
                status["launchUrl"] = launch_url
                return status

        @app.post("/api/agent/close")
        async def close(request: Request):
            authorize(request, native=True)
            if not self.managed:
                raise WorkspaceError(
                    "manual_instance",
                    "Flush and close this manually launched workspace in its terminal.",
                )
            if (
                (self.stopping and not self.close_failed)
                or self.active_calls
                or self.operations.active
                or s.mcp_broker.status()["pendingRequests"]
            ):
                raise WorkspaceError(
                    "workspace_busy",
                    "Wait for active workspace operations before closing.",
                )
            self.stopping = True
            retrying_persistence = self.close_failed
            self.close_failed = False
            result = {"ok": True, "previouslyConfirmed": True}
            if not retrying_persistence:
                try:
                    result = await s.mcp_broker.request("workspace.flush", timeout=15)
                    if not isinstance(result, dict) or not result.get("ok"):
                        raise WorkspaceError(
                            "flush_failed",
                            "The browser could not confirm its final save. The server remains running.",
                        )
                except BaseException as exc:
                    self.stopping = False
                    try:
                        await s.mcp_broker.request("workspace.resume", timeout=2)
                    except Exception:
                        pass
                    from ..web.mcp_bridge import McpBridgeError

                    if isinstance(exc, McpBridgeError):
                        raise WorkspaceError(
                            exc.code,
                            "The owning browser could not confirm its final save. Reconnect it and retry close; the server remains running.",
                        ) from exc
                    raise
            try:
                await s._app_resources.close()
            except (Exception, asyncio.CancelledError) as exc:
                self.close_failed = True
                if isinstance(exc, asyncio.CancelledError):
                    raise
                raise WorkspaceError(
                    "persistence_failed",
                    "Database shutdown could not confirm persistence. Admission remains stopped; resolve the storage problem and retry close. No successful close was recorded.",
                ) from exc
            self.close_failed = False
            # Reply only after persistence, before stopping the shared listener.
            asyncio.get_running_loop().call_later(
                0.2, setattr, s._http_server, "should_exit", True
            )
            return {
                "ok": True,
                "instanceId": s.access.binding,
                "lifecycle": "stopping",
                "flush": result,
            }

        @app.get("/api/workspaces")
        async def recent(request: Request):
            authorize(request, "read")
            from .manager import Manager

            return await asyncio.to_thread(
                Manager(self.catalog).list,
                refresh=request.query_params.get("refresh") == "true",
                offset=int(request.query_params.get("offset", "0")),
            )

        @app.post("/api/workspaces/{action}")
        async def catalog_action(action: str, request: Request):
            authorize(request)
            from .manager import Manager

            body = await request.json()
            manager = Manager(self.catalog)
            if action == "open":
                return await asyncio.to_thread(manager.open, **body)
            if action == "locate":
                return await asyncio.to_thread(manager.locate, **body)
            if action == "forget":
                return await asyncio.to_thread(self.catalog.forget, body["workspaceId"])
            if action == "rename":
                renamed = await asyncio.to_thread(
                    self.catalog.rename, body["workspaceId"], body["name"]
                )
                if (
                    self.workspace
                    and renamed["workspaceId"] == self.workspace["workspaceId"]
                ):
                    self.workspace = renamed
                return renamed
            if action == "reveal":
                if not s.db_path:
                    raise WorkspaceError(
                        "temporary_workspace",
                        "Temporary workspaces have no project folder.",
                    )
                command = (
                    ["/usr/bin/open", "-R", str(s.db_path)]
                    if sys.platform == "darwin"
                    else ["xdg-open", str(s.db_path.parent)]
                )
                await asyncio.to_thread(subprocess.run, command, check=True, timeout=5)
                return {"ok": True}
            raise WorkspaceError("unknown_action", "Unknown catalog operation.")
