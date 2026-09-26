"""Reusable ASGI composition without SQLRooms UI or CLI imports."""

from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI, Request
from starlette.responses import JSONResponse

from .access import AccessDenied
from .transport import DuckDBTransport, MAX_MESSAGE_BYTES

# Use a single worker per writable workspace. Explicit transport settings match
# the message and receive queue limits. Compression is disabled deliberately:
# compressing a large Arrow frame in the WebSocket driver blocks the shared
# event loop, delaying cancellation and HTTP control (see verification report).
UVICORN_OPTIONS = dict(
    workers=1,
    ws="websockets",
    ws_max_size=MAX_MESSAGE_BYTES,
    ws_max_queue=4,
    ws_per_message_deflate=False,
    ws_ping_interval=20,
    ws_ping_timeout=20,
    lifespan="on",
    loop="asyncio",
)


class AppResources:
    """Own database, optional sync and caller-supplied application lifecycles."""

    def __init__(
        self, runtime, transport, *, sync_enabled=False, allow_client_snapshots=False
    ):
        self.runtime = runtime
        self.transport = transport
        self.sync_enabled = sync_enabled
        self.allow_client_snapshots = allow_client_snapshots
        self.sync = None
        self.failure = None
        self.start_error = None
        self.close_lock = asyncio.Lock()

    async def start(self):
        await self.runtime.start()
        if self.sync_enabled:
            from .crdt.state import CrdtState
            from .crdt.ws import CrdtWs
            from loro import LoroDoc, ExportMode

            self.sync = CrdtState(self.runtime)
            self.transport.crdt = CrdtWs(
                app=self.transport,
                state=self.sync,
                allow_client_snapshots=self.allow_client_snapshots,
                empty_snapshot_len=len(LoroDoc().export(ExportMode.Snapshot())),
            )

    async def close(self, *, final=False):
        """Keep managed persistence failures retryable; final teardown releases all resources."""
        async with self.close_lock:
            try:
                await self.transport.drain()
                if self.sync:
                    await self.sync.close()
                await self.runtime.close()
            except BaseException as exc:
                self.failure = exc
                if final:
                    # Do not label a failed sync/checkpoint as saved, but do not
                    # leak the database/executor during process teardown either.
                    await self.runtime.abort()
                raise
            else:
                self.failure = None


def create_app(
    runtime,
    security,
    *,
    title="SQLRooms runtime",
    sync_enabled=False,
    allow_client_snapshots=False,
    lifespan=None,
    configure=None,
):
    """Compose one authenticated app with explicit resources and application routes.

    ``configure(app)`` registers caller-owned APIs/assets after protocol routes.
    ``lifespan(app)`` is an optional async context manager for browser/MCP resources;
    it does not create a listener. The caller supplies identity, storage and access.
    """
    transport = DuckDBTransport(runtime, security)
    resources = AppResources(
        runtime,
        transport,
        sync_enabled=sync_enabled,
        allow_client_snapshots=allow_client_snapshots,
    )

    @asynccontextmanager
    async def shared_lifespan(app):
        try:
            try:
                await resources.start()
            except BaseException as exc:
                resources.start_error = exc
                raise
            if lifespan:
                async with lifespan(app):
                    yield
            else:
                yield
        finally:
            await resources.close(final=True)

    app = FastAPI(title=title, lifespan=shared_lifespan)
    app.state.resources = resources

    @app.middleware("http")
    async def host_boundary(request: Request, call_next):
        try:
            security.check_headers(request.headers)
        except AccessDenied as exc:
            return JSONResponse({"error": exc.code}, status_code=403)
        return await call_next(request)

    @app.get("/healthz")
    async def health():
        return {"status": "ok"}

    @app.get("/readyz")
    async def ready():
        return JSONResponse(
            {"status": "ready" if runtime.ready else "not ready"},
            status_code=200 if runtime.ready else 503,
        )

    @app.get("/version")
    async def version(request: Request):
        from importlib.metadata import version
        import duckdb

        try:
            security.authorize(request.headers, "read")
        except AccessDenied as exc:
            return JSONResponse({"error": exc.code}, status_code=401)
        return {
            "name": "sqlrooms",
            "version": version("sqlrooms"),
            "duckdb": duckdb.__version__,
        }

    app.add_api_websocket_route("/ws/duckdb", transport.handle)
    if configure:
        configure(app)
    return app
