"""Roomie's application routes around the shared authenticated DuckDB runtime."""

from contextlib import asynccontextmanager
import asyncio
from pathlib import Path
import sys
from urllib.parse import urlsplit
import webbrowser

from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse
import uvicorn
from sqlrooms.agent import registry
from sqlrooms.agent.process import reserve_listener
from sqlrooms.agent.runtime import Runtime
from sqlrooms.server.access import AccessDenied, LocalAccess
from sqlrooms.server.app import UVICORN_OPTIONS, create_app
from sqlrooms.server.bootstrap import register_bootstrap_routes
from sqlrooms.server.runtime import DuckDBRuntime
from sqlrooms.server.security import (
    CredentialFile,
    NO_STORE,
    TransportSecurity,
    normalize_transport_url,
)
from sqlrooms.web.mcp import SqlroomsMcpService
from sqlrooms.web.mcp_bridge import McpBridgeBroker
from .settings import settings


class RoomieServer:
    """One application, one listener, one writable database; no AI or sync startup."""

    def __init__(self, database=":memory:", *, port=0, external_url=None):
        self.settings = settings()
        self.host = "127.0.0.1"
        self.port = port
        self.db_path = (
            None if database == ":memory:" else Path(database).expanduser().resolve()
        )
        self.duckdb_database = str(self.db_path) if self.db_path else ":memory:"
        self.external_url = (
            normalize_transport_url(external_url).rstrip("/") if external_url else None
        )
        if self.external_url and urlsplit(self.external_url).hostname not in {
            "localhost",
            "127.0.0.1",
        }:
            raise ValueError("Development UI must use a local HTTP origin.")
        if self.external_url and urlsplit(self.external_url).scheme != "http":
            raise ValueError("Development UI must use a local HTTP origin.")
        self.serve_ui = True
        self.access = LocalAccess()
        self.security = TransportSecurity(self.access, set(), set())
        self._configure_origins()
        self.runtime = DuckDBRuntime(
            self.duckdb_database,
            self.settings.home() / "uploads",
            meta_namespace="__roomie",
            sync_storage=False,
        )
        self.mcp_broker = McpBridgeBroker(
            self.access.native_token, security=self.security
        )
        self.agent_runtime = Runtime(self, settings=self.settings)
        self.mcp_broker.agent_runtime = self.agent_runtime
        self.mcp_service = SqlroomsMcpService(
            self.mcp_broker, security=self.security, name="Roomie"
        )
        self.credential_file = None
        self._app_resources = None
        self._http_server = None
        self.static = Path(__file__).parent / "static"

    def _configure_origins(self):
        origins = {f"http://{host}:{self.port}" for host in ("127.0.0.1", "localhost")}
        if self.external_url:
            parsed = urlsplit(self.external_url)
            origins.add(f"{parsed.scheme}://{parsed.netloc}")
        self.security.origins = origins
        self.security.hosts = {urlsplit(origin).netloc for origin in origins}

    def _ui_url(self):
        return f"http://127.0.0.1:{self.port}"

    def _mcp_url(self):
        return self._ui_url() + "/mcp"

    def _launch_url(self):
        return (
            (self.external_url or self._ui_url())
            + "/#roomie-ticket="
            + self.access.ticket()
        )

    def _mcp_status(self):
        return {"enabled": self.mcp_service.enabled, "bridge": self.mcp_broker.status()}

    @asynccontextmanager
    async def lifespan(self, app):
        async with self.mcp_service.lifespan():
            self.mcp_service.enabled = True
            try:
                yield
            finally:
                self.mcp_service.enabled = False
                await self.mcp_broker.close()

    def app(self):
        app = create_app(
            self.runtime,
            self.security,
            title="Roomie",
            distribution="roomie",
            sync_enabled=False,
            lifespan=self.lifespan,
            configure=self.routes,
        )
        self._app_resources = app.state.resources
        return app

    def routes(self, app):
        @app.middleware("http")
        async def authorize(request: Request, call_next):
            try:
                path = request.url.path
                if path.startswith("/api/") and path != "/api/auth/exchange":
                    operation = "read"
                    if path == "/api/config":
                        operation = "page-config"
                    elif path == "/api/auth/renew":
                        operation = "renew"
                    elif path == "/api/auth/ticket":
                        operation = "bootstrap"
                    elif request.method not in {"GET", "HEAD"}:
                        operation = (
                            "control"
                            if path.startswith(("/api/agent/", "/api/workspaces"))
                            else "query"
                        )
                    if self.agent_runtime.stopping and operation == "query":
                        raise AccessDenied("workspace_closing")
                    self.security.authorize(request.headers, operation)
                response = await call_next(request)
            except AccessDenied as exc:
                response = JSONResponse(
                    {"error": exc.code},
                    status_code=401 if exc.code == "unauthorized" else 403,
                )
            response.headers.update(NO_STORE)
            return response

        register_bootstrap_routes(app, self.access, self._launch_url)
        from sqlrooms.web.local_file import resolve_local_file

        app.add_api_route("/api/local-file", resolve_local_file, methods=["POST"])
        self.agent_runtime.routes(app)
        app.add_api_websocket_route("/ws/mcp-bridge", self.mcp_broker.handle_websocket)
        # The SDK owns /mcp itself; do not strip its path or redirect a POST.
        from starlette.routing import Route

        app.router.routes.append(
            Route("/mcp", endpoint=self.mcp_service, methods=["GET", "POST", "DELETE"])
        )

        @app.get("/api/config")
        async def config():
            page_url = self.external_url or self._ui_url()
            return {
                "application": "roomie",
                "schemaVersion": 1,
                "databasePath": self.duckdb_database,
                "binding": self.access.binding,
                "wsUrl": page_url.replace("http:", "ws:") + "/ws/duckdb",
                "bridgeUrl": page_url.replace("http:", "ws:") + "/ws/mcp-bridge",
            }

        @app.get("/api/status")
        async def status():
            return self.agent_runtime.identity()

        @app.get("/")
        async def index():
            return FileResponse(self.static / "index.html")

        @app.get("/{asset:path}")
        async def static(asset: str):
            candidate = (self.static / asset).resolve()
            if (
                not candidate.is_relative_to(self.static.resolve())
                or not candidate.is_file()
            ):
                return JSONResponse({"error": "not_found"}, status_code=404)
            return FileResponse(candidate)

    async def start(self, *, open_browser=True):
        if not self.external_url and not (self.static / "index.html").is_file():
            raise RuntimeError(
                "Roomie UI assets are missing. Build roomie-cli-app and bundle the wheel."
            )
        sock = reserve_listener(self.host, self.port)
        self.port = sock.getsockname()[1]
        self._configure_origins()
        binding = self.access.binding
        task = None
        try:
            self.credential_file = CredentialFile(
                self.access,
                self._ui_url(),
                self._mcp_url(),
                self._ui_url().replace("http:", "ws:") + "/ws/duckdb",
            )
            server = uvicorn.Server(
                uvicorn.Config(
                    self.app(),
                    host=self.host,
                    port=self.port,
                    log_level="warning",
                    access_log=False,
                    **UVICORN_OPTIONS,
                )
            )
            self._http_server = server
            task = asyncio.create_task(server.serve(sockets=[sock]))
            for _ in range(1500):
                if task.done():
                    await task
                    raise RuntimeError(
                        "Roomie failed to start; inspect the database and runtime error above."
                    )
                if server.started and self.runtime.ready:
                    break
                await asyncio.sleep(0.01)
            else:
                raise RuntimeError("Roomie startup timed out.")
            await self.agent_runtime.publish()
            print(f"Roomie: {self.duckdb_database} ({self._ui_url()})", file=sys.stderr)
            if open_browser and not self.external_url:
                await asyncio.to_thread(webbrowser.open_new_tab, self._launch_url())
            if sys.stderr.isatty() and not self.external_url:
                print(
                    "Temporary Roomie launch link (2 minutes): " + self._launch_url(),
                    file=sys.stderr,
                )
            await task
            if self._app_resources.failure:
                raise RuntimeError(
                    "Workspace persistence failed during shutdown."
                ) from self._app_resources.failure
        finally:
            if task and not task.done():
                self._http_server.should_exit = True
                await task
            registry.remove(binding, settings=self.settings)
            self.access.invalidate()
            if self.credential_file:
                self.credential_file.close()
            sock.close()
