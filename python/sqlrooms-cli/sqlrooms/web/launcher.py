from __future__ import annotations

import logging
import os
import json
import re
import socket
import tempfile
import threading
import webbrowser
import uuid
from pathlib import Path
from typing import Any, Dict
import base64

import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from diskcache import Cache
from sqlrooms.server import db_async
from sqlrooms.server.server import server as duckdb_ws_server

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


def _normalize_sql_for_policy(sql: str) -> str:
    normalized = sql.strip()
    if normalized.endswith(";"):
        normalized = normalized[:-1].strip()
    return normalized


def _is_select_only_sql(sql: str) -> bool:
    normalized = _normalize_sql_for_policy(sql)
    if not normalized:
        return False
    # One statement only.
    if ";" in normalized:
        return False
    lower = normalized.lower()
    return lower.startswith("select ") or lower.startswith("with ")


def _references_internal_namespace(sql: str, namespace: str) -> bool:
    pattern = re.compile(rf"(^|[^A-Za-z0-9_]){re.escape(namespace)}\s*\.", re.IGNORECASE)
    return bool(pattern.search(sql))


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
        postgres_dsn: str | None = None,
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
        self.postgres_dsn = postgres_dsn
        self.open_browser = open_browser
        self.sync_enabled = bool(sync_enabled)
        self.meta_db = meta_db
        self.meta_namespace = meta_namespace

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
            "dbPath": self.duckdb_database,
            "metaNamespace": self.meta_namespace,
            "postgresBridgeEnabled": bool(self.postgres_dsn),
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
        async def add_cross_origin_isolation_headers(
            request: Request, call_next
        ):
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
            _ = payload.get("connectionId")
            if not self.postgres_dsn:
                return {"ok": False, "error": "postgres bridge is not configured"}
            try:
                import psycopg  # type: ignore

                with psycopg.connect(self.postgres_dsn) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT 1")
                        cur.fetchone()
                return {"ok": True}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}

        @app.post("/api/db/list-catalog")
        async def list_catalog(payload: Dict[str, Any]):
            _ = payload.get("connectionId")
            if not self.postgres_dsn:
                return {
                    "databases": [],
                    "schemas": [],
                    "tables": [],
                    "error": "postgres bridge is not configured",
                }
            try:
                import psycopg  # type: ignore

                with psycopg.connect(self.postgres_dsn) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT current_database()")
                        db = cur.fetchone()[0]
                        cur.execute(
                            """
                            SELECT schema_name
                            FROM information_schema.schemata
                            ORDER BY schema_name
                            """
                        )
                        schemas = [{"database": db, "schema": r[0]} for r in cur.fetchall()]
                        cur.execute(
                            """
                            SELECT table_schema, table_name, table_type
                            FROM information_schema.tables
                            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                            ORDER BY table_schema, table_name
                            """
                        )
                        tables = [
                            {
                                "database": db,
                                "schema": r[0],
                                "table": r[1],
                                "isView": str(r[2]).upper().endswith("VIEW"),
                            }
                            for r in cur.fetchall()
                        ]
                return {"databases": [{"database": db}], "schemas": schemas, "tables": tables}
            except Exception as exc:
                return {
                    "databases": [],
                    "schemas": [],
                    "tables": [],
                    "error": str(exc),
                }

        @app.post("/api/db/execute-query")
        async def execute_query(payload: Dict[str, Any]):
            if not self.postgres_dsn:
                return {"error": "postgres bridge is not configured"}
            sql = payload.get("sql", "")
            query_type = payload.get("queryType", "json")
            if not isinstance(sql, str) or not sql.strip():
                return {"error": "sql is required"}
            try:
                import psycopg  # type: ignore

                with psycopg.connect(self.postgres_dsn) as conn:
                    with conn.cursor() as cur:
                        cur.execute(sql)
                        if query_type == "exec":
                            return {"ok": True}
                        rows = cur.fetchall()
                        columns = [d.name for d in cur.description or []]
                        json_data = [dict(zip(columns, row)) for row in rows]
                        return {"jsonData": json_data}
            except Exception as exc:
                return {"error": str(exc)}

        @app.post("/api/db/fetch-arrow")
        async def fetch_arrow(payload: Dict[str, Any]):
            if not self.postgres_dsn:
                return JSONResponse(
                    {"error": "postgres bridge is not configured"},
                    status_code=400,
                )
            sql = payload.get("sql", "")
            if not isinstance(sql, str) or not sql.strip():
                return JSONResponse({"error": "sql is required"}, status_code=400)
            try:
                import pyarrow as pa
                import psycopg  # type: ignore

                with psycopg.connect(self.postgres_dsn) as conn:
                    with conn.cursor() as cur:
                        cur.execute(sql)
                        rows = cur.fetchall()
                        columns = [d.name for d in cur.description or []]
                as_dicts = [dict(zip(columns, row)) for row in rows]
                table = pa.Table.from_pylist(as_dicts)
                sink = pa.BufferOutputStream()
                with pa.ipc.new_stream(sink, table.schema) as writer:
                    writer.write_table(table)
                raw = sink.getvalue().to_pybytes()
                # JSON-safe transport for now; frontend bridge may decode when needed.
                return {"arrowBase64": base64.b64encode(raw).decode("ascii")}
            except Exception as exc:
                return JSONResponse({"error": str(exc)}, status_code=500)

        @app.post("/api/db/cancel-query")
        async def cancel_query(payload: Dict[str, Any]):
            _ = payload.get("queryId")
            # Not implemented yet for Postgres bridge in CLI mode.
            return {"cancelled": False}

        @app.get("/api/project/info")
        async def project_info():
            return {
                "mode": "artifact",
                "dbPath": self.duckdb_database,
                "metaNamespace": self.meta_namespace,
            }

        @app.get("/api/artifacts")
        async def list_artifacts():
            table_ref = f'"{self.meta_namespace}"."artifacts"'

            def _query(cur):
                rows = cur.execute(
                    f"""
                    SELECT artifact_id, type, name, metadata_json, created_at, updated_at
                    FROM {table_ref}
                    ORDER BY updated_at DESC
                    """
                ).fetchall()
                results = []
                for artifact_id, atype, name, metadata_json, created_at, updated_at in rows:
                    metadata = {}
                    if metadata_json:
                        if isinstance(metadata_json, str):
                            try:
                                metadata = json.loads(metadata_json)
                            except Exception:
                                metadata = {}
                        else:
                            metadata = metadata_json
                    results.append(
                        {
                            "artifactId": artifact_id,
                            "type": atype,
                            "name": name,
                            "metadata": metadata,
                            "createdAt": str(created_at) if created_at else None,
                            "updatedAt": str(updated_at) if updated_at else None,
                        }
                    )
                return results

            return await db_async.run_db_task(_query)

        @app.post("/api/artifacts")
        async def create_artifact(payload: Dict[str, Any]):
            atype = str(payload.get("type") or "").strip().lower()
            if atype not in ("notebook", "canvas", "app"):
                return JSONResponse({"error": "invalid artifact type"}, status_code=400)
            name = str(payload.get("name") or "").strip() or f"{atype}-{uuid.uuid4().hex[:8]}"
            metadata = payload.get("metadata") or {}
            artifact_id = uuid.uuid4().hex

            table_ref = f'"{self.meta_namespace}"."artifacts"'

            def _insert(cur):
                cur.execute(
                    f"""
                    INSERT INTO {table_ref}(artifact_id, type, name, metadata_json, created_at, updated_at)
                    VALUES (?, ?, ?, CAST(? AS JSON), now(), now())
                    """,
                    [artifact_id, atype, name, json.dumps(metadata)],
                )

            await db_async.run_db_task(_insert)
            return {
                "artifactId": artifact_id,
                "type": atype,
                "name": name,
                "metadata": metadata,
            }

        @app.put("/api/artifacts/{artifact_id}/files")
        async def put_artifact_files(artifact_id: str, payload: Dict[str, Any]):
            files = payload.get("files")
            if not isinstance(files, list):
                return JSONResponse({"error": "files must be an array"}, status_code=400)

            files_ref = f'"{self.meta_namespace}"."artifact_files"'

            def _write(cur):
                for item in files:
                    path = str((item or {}).get("path") or "").strip()
                    content = str((item or {}).get("content") or "")
                    if not path:
                        continue
                    cur.execute(
                        f"""
                        INSERT INTO {files_ref}(artifact_id, path, content, updated_at)
                        VALUES (?, ?, ?, now())
                        ON CONFLICT(artifact_id, path)
                        DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
                        """,
                        [artifact_id, path, content],
                    )

            await db_async.run_db_task(_write)
            return {"ok": True}

        @app.get("/api/artifacts/{artifact_id}/files")
        async def get_artifact_files(artifact_id: str):
            files_ref = f'"{self.meta_namespace}"."artifact_files"'

            def _read(cur):
                rows = cur.execute(
                    f"""
                    SELECT path, content
                    FROM {files_ref}
                    WHERE artifact_id = ?
                    ORDER BY path
                    """,
                    [artifact_id],
                ).fetchall()
                return [{"path": r[0], "content": r[1]} for r in rows]

            return await db_async.run_db_task(_read)

        @app.get("/api/notebooks/{artifact_id}")
        async def read_notebook(artifact_id: str):
            files_ref = f'"{self.meta_namespace}"."artifact_files"'

            def _read(cur):
                row = cur.execute(
                    f"""
                    SELECT content
                    FROM {files_ref}
                    WHERE artifact_id = ? AND path = '/notebook.json'
                    LIMIT 1
                    """,
                    [artifact_id],
                ).fetchone()
                if not row:
                    return {"cells": []}
                try:
                    return json.loads(row[0])
                except Exception:
                    return {"cells": []}

            return await db_async.run_db_task(_read)

        @app.put("/api/notebooks/{artifact_id}/cells")
        async def update_notebook_cells(artifact_id: str, payload: Dict[str, Any]):
            cells = payload.get("cells")
            if not isinstance(cells, list):
                return JSONResponse({"error": "cells must be an array"}, status_code=400)
            files_ref = f'"{self.meta_namespace}"."artifact_files"'
            content = json.dumps({"cells": cells})

            def _write(cur):
                cur.execute(
                    f"""
                    INSERT INTO {files_ref}(artifact_id, path, content, updated_at)
                    VALUES (?, '/notebook.json', ?, now())
                    ON CONFLICT(artifact_id, path)
                    DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
                    """,
                    [artifact_id, content],
                )

            await db_async.run_db_task(_write)
            return {"ok": True}

        @app.post("/api/apps/{artifact_id}/validate")
        async def validate_app(artifact_id: str):
            files_ref = f'"{self.meta_namespace}"."artifact_files"'

            def _validate(cur):
                rows = cur.execute(
                    f"SELECT path FROM {files_ref} WHERE artifact_id = ?", [artifact_id]
                ).fetchall()
                existing = {r[0] for r in rows}
                errors = []
                for req in ("/package.json", "/index.html", "/src/main.jsx", "/src/App.jsx"):
                    if req not in existing:
                        errors.append(f"missing required file: {req}")
                return {"status": "ok" if not errors else "error", "errors": errors}

            return await db_async.run_db_task(_validate)

        @app.post("/api/apps/{artifact_id}/generate")
        async def generate_app(artifact_id: str, payload: Dict[str, Any]):
            prompt = str(payload.get("prompt") or "").strip()
            template = str(payload.get("template") or "mosaic-dashboard").strip()
            if not prompt:
                return JSONResponse({"error": "prompt is required"}, status_code=400)

            files_ref = f'"{self.meta_namespace}"."artifact_files"'
            artifacts_ref = f'"{self.meta_namespace}"."artifacts"'
            attempts = 0
            errors: list[str] = []

            def _template_files():
                if template == "basic-dashboard":
                    app_body = """import React from 'react';

export default function App() {
  return (
    <main style={{padding: 16}}>
      <h1>Analytics App</h1>
      <p>Prompt: %s</p>
      <p>Template: basic-dashboard</p>
    </main>
  );
}
""" % (
                        prompt.replace("%", "%%")
                    )
                else:
                    app_body = """import React from 'react';

export default function App() {
  return (
    <main style={{padding: 16}}>
      <h1>Mosaic Analytics App</h1>
      <p>Prompt: %s</p>
      <p>Template: mosaic-dashboard</p>
      <p>Add Mosaic cross-filter panels next.</p>
    </main>
  );
}
""" % (
                        prompt.replace("%", "%%")
                    )

                package_json = json.dumps(
                    {
                        "name": "sqlrooms-generated-app",
                        "private": True,
                        "version": "0.0.0",
                        "type": "module",
                        "scripts": {"dev": "vite", "build": "vite build"},
                        "dependencies": {"react": "^19.0.0", "react-dom": "^19.0.0"},
                        "devDependencies": {"vite": "^7.0.0"},
                    },
                    indent=2,
                )
                index_html = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SQLRooms Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
"""
                main_jsx = """import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
"""
                return {
                    "/package.json": package_json,
                    "/index.html": index_html,
                    "/src/main.jsx": main_jsx,
                    "/src/App.jsx": app_body,
                }

            async def _write_files(file_map: Dict[str, str]) -> None:
                def _write(cur):
                    for path, content in file_map.items():
                        cur.execute(
                            f"""
                            INSERT INTO {files_ref}(artifact_id, path, content, updated_at)
                            VALUES (?, ?, ?, now())
                            ON CONFLICT(artifact_id, path)
                            DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
                            """,
                            [artifact_id, path, content],
                        )

                await db_async.run_db_task(_write)

            async def _validate_now() -> Dict[str, Any]:
                return await validate_app(artifact_id)

            # bounded auto-fix loop: generate -> validate, retry with default scaffold
            while attempts < 3:
                attempts += 1
                await _write_files(_template_files())
                result = await _validate_now()
                if result.get("status") == "ok":
                    def _update_meta(cur):
                        cur.execute(
                            f"""
                            UPDATE {artifacts_ref}
                            SET metadata_json = CAST(? AS JSON), updated_at = now()
                            WHERE artifact_id = ?
                            """,
                            [json.dumps({"template": template, "prompt": prompt}), artifact_id],
                        )

                    await db_async.run_db_task(_update_meta)
                    return {"status": "ok", "attempts": attempts, "errors": errors}
                errors.extend(result.get("errors") or [])

            return {"status": "error", "attempts": attempts, "errors": errors}

        @app.post("/api/apps/{artifact_id}/probe-capabilities")
        async def probe_app_capabilities(artifact_id: str, payload: Dict[str, Any]):
            _ = artifact_id
            commands = payload.get("commands") if isinstance(payload, dict) else None
            if not isinstance(commands, list) or not commands:
                commands = ["node", "npm", "pnpm", "yarn", "npx", "jq", "grep"]
            # Server-side CLI mode does not execute app shell commands directly yet.
            # Return a conservative capabilities response.
            return {"capabilities": {str(cmd): False for cmd in commands}}

        @app.post("/api/apps/{artifact_id}/shell")
        async def app_shell(artifact_id: str, payload: Dict[str, Any]):
            _ = artifact_id
            command = str(payload.get("command") or "").strip()
            args = payload.get("args") or []
            if not command:
                return JSONResponse({"error": "command is required"}, status_code=400)
            if not isinstance(args, list):
                return JSONResponse({"error": "args must be an array"}, status_code=400)

            allowed = {"node", "npm", "npx", "pnpm", "yarn", "jq", "grep"}
            if command not in allowed:
                return JSONResponse(
                    {"error": f"command '{command}' is not allowed"},
                    status_code=403,
                )

            # In CLI MVP, the shell capability is implemented in browser runtime (webcontainer).
            # This endpoint exists as the artifact-oriented API surface and returns an explicit
            # unsupported response for server-side execution.
            return JSONResponse(
                {
                    "error": "server-side app shell is not implemented in CLI mode",
                    "supported": False,
                },
                status_code=501,
            )

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
                    {"error": f"Access to internal schema {self.meta_namespace} is denied"},
                    status_code=403,
                )

            logger.info("project_query sql=%s", _normalize_sql_for_policy(sql)[:2000])

            def _run(cur):
                rows = cur.execute(sql).fetchall()
                columns = [d[0] for d in (cur.description or [])]
                limited = rows[:5000]
                return {
                    "columns": columns,
                    "rows": [dict(zip(columns, row)) for row in limited],
                    "rowCount": len(limited),
                    "truncated": len(rows) > len(limited),
                }

            data = await db_async.run_db_task(_run)
            return {"type": "json", "data": data}

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

