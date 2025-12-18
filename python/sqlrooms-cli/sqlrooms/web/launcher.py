from __future__ import annotations

import asyncio
import logging
import os
import socket
import tempfile
import threading
import webbrowser
from pathlib import Path
from typing import Any, Dict

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from diskcache import Cache
from sqlrooms.server import db_async
from sqlrooms.server.server import server as duckdb_ws_server

from .state_store import DuckDBStateStore
from .ui import BuiltinUiProvider, DirectoryUiProvider, UiProvider

logger = logging.getLogger(__name__)


def _sanitize_filename(name: str) -> str:
    safe = os.path.basename(name.strip().replace("\\", "/"))
    return safe or "upload.dat"

def _pick_free_port(host: str) -> int:
    """
    Pick an available TCP port for a local background server.

    This is best-effort: we bind to port 0 to have the OS select a free port,
    read it back, then close the socket.
    """
    is_ipv6 = ":" in host and host != "0.0.0.0"
    family = socket.AF_INET6 if is_ipv6 else socket.AF_INET
    sock = socket.socket(family, socket.SOCK_STREAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        if family == socket.AF_INET6:
            sock.bind((host, 0, 0, 0))
        else:
            sock.bind((host, 0))
        return int(sock.getsockname()[1])
    finally:
        sock.close()


class SqlroomsHttpServer:
    def __init__(
        self,
        db_path: str | Path,
        host: str,
        port: int,
        ws_port: int | None,
        llm_provider: str | None = None,
        llm_model: str | None = None,
        api_key: str | None = None,
        open_browser: bool = True,
        ui_dir: str | None = None,
    ):
        db_path_str = str(db_path)
        self.is_in_memory = db_path_str == ":memory:"
        if self.is_in_memory:
            self.db_path: Path | None = None
            self.duckdb_database = ":memory:"
            base_dir = Path(tempfile.gettempdir()) / "sqlrooms-cli"
        else:
            self.db_path = Path(db_path).expanduser().resolve()
            self.duckdb_database = str(self.db_path)
            base_dir = self.db_path.parent

        self.host = host
        self.port = port
        if ws_port is None:
            # socketify listens on all interfaces; we pick a free local port for convenience
            # to avoid collisions when multiple dev servers are running.
            self.ws_port = _pick_free_port(self._public_host())
        else:
            self.ws_port = ws_port
        self.llm_provider = llm_provider
        self.llm_model = llm_model
        self.api_key = api_key
        self.open_browser = open_browser

        self.ui_provider: UiProvider = (
            DirectoryUiProvider(ui_dir) if ui_dir else BuiltinUiProvider()
        )
        self.static_dir = self.ui_provider.static_dir()
        self.index_html = self.ui_provider.index_html()
        self.upload_dir = base_dir / "sqlrooms_uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)

        self.state_store = DuckDBStateStore(self.duckdb_database)
        self._duckdb_thread: threading.Thread | None = None

    async def start(self) -> None:
        logger.info("Starting sqlrooms CLI server")
        self._start_duckdb_backend()
        app = self._build_app()

        if self.open_browser:
            threading.Timer(1.0, self._open_browser).start()

        config = uvicorn.Config(
            app, host=self.host, port=self.port, log_level="info", loop="asyncio"
        )
        server = uvicorn.Server(config)
        await server.serve()

    def _open_browser(self) -> None:
        url = f"http://{self._public_host()}:{self.port}"
        try:
            webbrowser.open_new_tab(url)
        except Exception as exc:
            logger.debug("Failed to open browser: %s", exc)
        else:
            logger.info("Opened browser at %s", url)

    def _public_host(self) -> str:
        return "localhost" if self.host in ("0.0.0.0", "::") else self.host

    def _start_duckdb_backend(self) -> None:
        thread = threading.Thread(
            target=self._run_duckdb_server,
            daemon=True,
            name="duckdb-ws-server",
        )
        thread.start()
        self._duckdb_thread = thread
        logger.info(
            "Started DuckDB websocket backend at ws://%s:%s",
            self._public_host(),
            self.ws_port,
        )

    def _runtime_config(self) -> Dict[str, Any]:
        return {
            "wsUrl": f"ws://{self._public_host()}:{self.ws_port}",
            "apiBaseUrl": "",
            "llmProvider": self.llm_provider,
            "llmModel": self.llm_model,
            "apiKey": self.api_key or "",
            "dbPath": self.duckdb_database,
        }

    def _build_app(self) -> FastAPI:
        app = FastAPI(title="sqlrooms", version="0.1.0")
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @app.get("/api/config")
        async def get_config():
            return self._runtime_config()

        @app.get("/config.json")
        async def get_config_json():
            return self._runtime_config()

        @app.get("/api/state")
        async def get_state():
            return self.state_store.load_state()

        @app.post("/api/state")
        async def save_state(payload: Dict[str, Any]):
            state = payload.get("state") or payload.get("value") or payload
            if not isinstance(state, dict):
                raise HTTPException(status_code=400, detail="Invalid state payload")
            self.state_store.save_state(state)
            return {"ok": True}

        @app.delete("/api/state")
        async def clear_state():
            self.state_store.clear()
            return {"ok": True}

        @app.post("/api/upload")
        async def upload_file(file: UploadFile = File(...)):
            content = await file.read()
            safe_name = _sanitize_filename(file.filename)
            target = self.upload_dir / safe_name
            with open(target, "wb") as f:
                f.write(content)
            return {"path": str(target)}

        if self.static_dir.exists():
            app.mount(
                "/",
                StaticFiles(directory=self.static_dir, html=True),
                name="static",
            )

            @app.get("/{full_path:path}")
            async def spa_fallback(full_path: str):
                if self.index_html.exists():
                    return FileResponse(self.index_html)
                return JSONResponse({"error": "UI bundle not found"}, status_code=404)
        else:
            logger.warning(
                "Static bundle missing at %s. UI will not load until built.",
                self.index_html,
            )

        return app

    def _run_duckdb_server(self) -> None:
        import signal

        # In some environments (notably when embedding), signal handlers can only be
        # registered from the main thread. The websocket server itself does not rely
        # on signals, so we no-op signal registration in this background thread.
        original_signal = signal.signal

        def _noop_signal(*_args, **_kwargs):
            return None

        signal.signal = _noop_signal  # type: ignore
        try:
            db_async.init_global_connection(self.duckdb_database, extensions=["httpfs"])
            cache = Cache()
            duckdb_ws_server(cache, self.ws_port, auth_token=None)
        finally:
            signal.signal = original_signal  # type: ignore

