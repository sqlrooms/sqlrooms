from __future__ import annotations

import logging
import os
import re
import socket
import tempfile
import threading
import webbrowser
import json
from pathlib import Path
from typing import Any, Dict

import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from diskcache import Cache
from sqlrooms.server import db_async
from sqlrooms.server.server import server as duckdb_ws_server

from .db_bridge import (
    PostgresConnectorSettings,
    SnowflakeConnectorSettings,
    UnknownBridgeConnectionError,
    build_cli_db_bridge_registry,
)
from .ui import BuiltinUiProvider, DirectoryUiProvider, UiProvider

logger = logging.getLogger(__name__)
DB_BRIDGE_ID = "sqlrooms-cli-http-bridge"


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


def _normalize_sql_for_policy(sql: str) -> str:
    normalized = sql.strip()
    if normalized.endswith(";"):
        normalized = normalized[:-1].strip()
    return normalized


def _redact_sql_literals(sql: str) -> str:
    # Redact quoted strings and numeric literals before logging user SQL.
    redacted = re.sub(r"'(?:''|[^'])*'", "'***'", sql)
    redacted = re.sub(r'"(?:""|[^"])*"', '"***"', redacted)
    redacted = re.sub(r"\b\d+(?:\.\d+)?\b", "?", redacted)
    return redacted


def _is_select_only_sql(sql: str) -> bool:
    normalized = _normalize_sql_for_policy(sql)
    if not normalized:
        return False
    # One statement only.
    if ";" in normalized:
        return False
    return bool(re.match(r"^(select|with)\s", normalized, re.IGNORECASE))


def _references_internal_namespace(sql: str, namespace: str) -> bool:
    escaped = re.escape(namespace)
    pattern = re.compile(
        rf"(^|[^A-Za-z0-9_])(?:{escaped}|\"{escaped}\"|`{escaped}`|\[{escaped}\])\s*\.",
        re.IGNORECASE,
    )
    return bool(pattern.search(sql))


def _encode_stream_frame(
    frame_type: str,
    *,
    query_id: str,
    payload: bytes = b"",
    error: str | None = None,
) -> bytes:
    header = {
        "type": frame_type,
        "queryId": query_id,
        "payloadLength": len(payload),
    }
    if error:
        header["error"] = error
    header_bytes = json.dumps(header).encode("utf-8")
    return len(header_bytes).to_bytes(4, byteorder="big") + header_bytes + payload


class SqlroomsHttpServer:
    def __init__(
        self,
        db_path: str | Path,
        host: str,
        port: int,
        ws_port: int | None,
        *,
        sync_enabled: bool = False,
        meta_db: str | None = None,
        meta_namespace: str = "__sqlrooms",
        llm_provider: str | None = None,
        llm_model: str | None = None,
        api_key: str | None = None,
        ai_providers: dict[str, dict[str, Any]] | None = None,
        connector_settings: list[PostgresConnectorSettings | SnowflakeConnectorSettings]
        | None = None,
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
        self.ai_providers = ai_providers or {}
        self.open_browser = open_browser
        self.sync_enabled = bool(sync_enabled)
        self.meta_db = meta_db
        self.meta_namespace = meta_namespace
        self.db_bridge_registry = build_cli_db_bridge_registry(
            bridge_id=DB_BRIDGE_ID,
            connector_settings=connector_settings,
        )

        self.ui_provider: UiProvider = (
            DirectoryUiProvider(ui_dir) if ui_dir else BuiltinUiProvider()
        )
        self.static_dir = self.ui_provider.static_dir()
        self.index_html = self.ui_provider.index_html()
        self.upload_dir = base_dir / "sqlrooms_uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self._duckdb_thread: threading.Thread | None = None

    async def start(self) -> None:
        logger.info("Starting sqlrooms CLI server")
        if self.meta_db:
            logger.info(
                "Meta DB is ENABLED (db=%s, namespace=%s)",
                self.meta_db,
                self.meta_namespace,
            )
        else:
            logger.info(
                "Meta DB is DISABLED (using schema=%s within main DB)",
                self.meta_namespace,
            )
        if self.sync_enabled:
            logger.info("CRDT sync is ENABLED")
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
            "aiProviders": self.ai_providers,
            "dbPath": self.duckdb_database,
            "metaNamespace": self.meta_namespace,
            "dbBridge": {
                "id": self.db_bridge_registry.bridge_id,
                "connections": self.db_bridge_registry.runtime_connections(),
                "diagnostics": self.db_bridge_registry.runtime_diagnostics(),
            },
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

        @app.middleware("http")
        async def add_cross_origin_isolation_headers(request: Request, call_next):
            response = await call_next(request)
            # WebContainer requires cross-origin isolation to transfer SharedArrayBuffer.
            response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
            response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
            response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
            return response

        @app.get("/api/config")
        async def get_config():
            return self._runtime_config()

        @app.get("/config.json")
        async def get_config_json():
            return self._runtime_config()

        @app.post("/api/upload")
        async def upload_file(file: UploadFile = File(...)):
            content = await file.read()
            safe_name = _sanitize_filename(file.filename)
            target = self.upload_dir / safe_name
            with open(target, "wb") as f:
                f.write(content)
            return {"path": str(target)}

        @app.post("/api/db/test-connection")
        async def test_connection(payload: Dict[str, Any]):
            connection_id = payload.get("connectionId")
            if not isinstance(connection_id, str) or not connection_id.strip():
                return {"ok": False, "error": "connectionId is required"}
            try:
                ok = self.db_bridge_registry.test_connection(connection_id)
                return {"ok": bool(ok)}
            except UnknownBridgeConnectionError as exc:
                return {"ok": False, "error": str(exc)}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}

        @app.post("/api/db/list-catalog")
        async def list_catalog(payload: Dict[str, Any]):
            connection_id = payload.get("connectionId")
            if not isinstance(connection_id, str) or not connection_id.strip():
                return {
                    "databases": [],
                    "schemas": [],
                    "tables": [],
                    "error": "connectionId is required",
                }
            try:
                return self.db_bridge_registry.list_catalog(connection_id)
            except UnknownBridgeConnectionError as exc:
                return {"databases": [], "schemas": [], "tables": [], "error": str(exc)}
            except Exception as exc:
                return {"databases": [], "schemas": [], "tables": [], "error": str(exc)}

        @app.post("/api/db/execute-query")
        async def execute_query(payload: Dict[str, Any]):
            connection_id = payload.get("connectionId")
            if not isinstance(connection_id, str) or not connection_id.strip():
                return JSONResponse(
                    {"error": "connectionId is required"}, status_code=400
                )
            sql = payload.get("sql", "")
            query_type = payload.get("queryType", "json")
            if query_type not in {"json", "exec"}:
                return JSONResponse(
                    {"error": "queryType must be either 'json' or 'exec'"},
                    status_code=400,
                )
            if not isinstance(sql, str) or not sql.strip():
                return JSONResponse({"error": "sql is required"}, status_code=400)
            try:
                return self.db_bridge_registry.execute_query(
                    connection_id=connection_id,
                    sql=sql,
                    query_type=query_type,
                )
            except UnknownBridgeConnectionError as exc:
                return JSONResponse({"error": str(exc)}, status_code=404)
            except Exception as exc:
                return JSONResponse({"error": str(exc)}, status_code=500)

        @app.post("/api/db/fetch-arrow")
        async def fetch_arrow(payload: Dict[str, Any]):
            connection_id = payload.get("connectionId")
            if not isinstance(connection_id, str) or not connection_id.strip():
                return JSONResponse(
                    {"error": "connectionId is required"}, status_code=400
                )
            sql = payload.get("sql", "")
            if not isinstance(sql, str) or not sql.strip():
                return JSONResponse({"error": "sql is required"}, status_code=400)
            try:
                arrow_bytes = self.db_bridge_registry.fetch_arrow_bytes(
                    connection_id=connection_id,
                    sql=sql,
                )
                return Response(
                    content=arrow_bytes,
                    media_type="application/vnd.apache.arrow.stream",
                )
            except UnknownBridgeConnectionError as exc:
                return JSONResponse({"error": str(exc)}, status_code=404)
            except Exception as exc:
                return JSONResponse({"error": str(exc)}, status_code=500)

        @app.post("/api/db/fetch-arrow-stream")
        async def fetch_arrow_stream(payload: Dict[str, Any], request: Request):
            connection_id = payload.get("connectionId")
            if not isinstance(connection_id, str) or not connection_id.strip():
                return JSONResponse(
                    {"error": "connectionId is required"}, status_code=400
                )
            sql = payload.get("sql", "")
            if not isinstance(sql, str) or not sql.strip():
                return JSONResponse({"error": "sql is required"}, status_code=400)
            query_id = payload.get("queryId")
            if not isinstance(query_id, str) or not query_id.strip():
                query_id = f"bridge_{os.urandom(8).hex()}"
            chunk_rows = payload.get("chunkRows")
            if not isinstance(chunk_rows, int) or chunk_rows <= 0:
                chunk_rows = 5000

            async def _stream():
                try:
                    for batch in self.db_bridge_registry.stream_arrow_batches(
                        connection_id=connection_id,
                        sql=sql,
                        chunk_rows=chunk_rows,
                        query_id=query_id,
                    ):
                        if await request.is_disconnected():
                            break
                        yield _encode_stream_frame(
                            "batch", query_id=query_id, payload=batch
                        )
                    yield _encode_stream_frame("end", query_id=query_id)
                except UnknownBridgeConnectionError as exc:
                    yield _encode_stream_frame(
                        "error", query_id=query_id, error=str(exc)
                    )
                except Exception as exc:
                    yield _encode_stream_frame(
                        "error", query_id=query_id, error=str(exc)
                    )

            return StreamingResponse(_stream(), media_type="application/octet-stream")

        @app.post("/api/db/cancel-query")
        async def cancel_query(payload: Dict[str, Any]):
            query_id = payload.get("queryId")
            connection_id = payload.get("connectionId")
            if not isinstance(query_id, str) or not query_id.strip():
                return {"cancelled": False, "error": "queryId is required"}
            if not isinstance(connection_id, str) or not connection_id.strip():
                return {"cancelled": False}
            try:
                cancelled = self.db_bridge_registry.cancel_query(
                    connection_id=connection_id,
                    query_id=query_id,
                )
                return {"cancelled": bool(cancelled)}
            except UnknownBridgeConnectionError:
                return {"cancelled": False}
            except Exception:
                return {"cancelled": False}

        @app.post("/api/project/query")
        async def project_query(payload: Dict[str, Any]):
            sql = str(payload.get("sql") or "")
            if not _is_select_only_sql(sql):
                return JSONResponse(
                    {"error": "Only SELECT statements are allowed"},
                    status_code=400,
                )
            if _references_internal_namespace(sql, self.meta_namespace):
                return JSONResponse(
                    {
                        "error": f"Access to internal schema {self.meta_namespace} is denied"
                    },
                    status_code=403,
                )

            logger.debug(
                "project_query sql=%s",
                _redact_sql_literals(_normalize_sql_for_policy(sql))[:2000],
            )

            def _run(cur):
                cur.execute(sql)
                columns = [d[0] for d in (cur.description or [])]
                fetched = cur.fetchmany(5001)
                truncated = len(fetched) > 5000
                limited = fetched[:5000]
                return {
                    "columns": columns,
                    "rows": [dict(zip(columns, row)) for row in limited],
                    "rowCount": len(limited),
                    "truncated": truncated,
                }

            try:
                data = await db_async.run_db_task(_run)
            except Exception as exc:
                return JSONResponse({"error": str(exc)}, status_code=400)
            return data

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
            duckdb_ws_server(
                cache,
                self.ws_port,
                auth_token=None,
                sync_enabled=self.sync_enabled,
                meta_db_path=self.meta_db,
                meta_namespace=self.meta_namespace,
                allow_client_snapshots=bool(
                    self.sync_enabled and self.duckdb_database == ":memory:"
                ),
            )
        finally:
            signal.signal = original_signal  # type: ignore
