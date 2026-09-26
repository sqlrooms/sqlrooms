from __future__ import annotations

import asyncio
import errno
import json
import logging
import os
import re
import socket
import sys
import tempfile
import threading
import webbrowser
from pathlib import Path
from typing import Any, Dict, Callable, Awaitable
from urllib.parse import urlsplit, urlunsplit

import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi import Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    FileResponse,
    JSONResponse,
    RedirectResponse,
    Response,
    StreamingResponse,
)

from contextlib import asynccontextmanager
from starlette.routing import Route
from sqlrooms.server.runtime import DuckDBRuntime
from sqlrooms.server.app import create_app, UVICORN_OPTIONS

from .db_bridge import (
    ENGINE_CONFIG_FIELDS,
    SUPPORTED_ENGINES,
    PostgresConnectorSettings,
    SnowflakeConnectorSettings,
    UnknownBridgeConnectionError,
    build_cli_db_bridge_registry,
    build_ephemeral_connector,
)
from sqlrooms.server.access import AccessDenied, LocalAccess
from .security import (
    CredentialFile,
    TransportSecurity,
    bearer,
    NO_STORE,
    normalize_transport_url,
    supports_private_credentials,
)
from .mcp import SqlroomsMcpService
from .mcp_bridge import McpBridgeBroker
from .ui import BuiltinUiProvider, DirectoryUiProvider, UiProvider

logger = logging.getLogger(__name__)
# Protocol DEBUG logging prints auth frames; keep it disabled even with --debug.
transport_logger = logging.getLogger("sqlrooms.authenticated_transport")
transport_logger.setLevel(logging.WARNING)
DB_BRIDGE_ID = "sqlrooms-cli-http-bridge"
UPLOAD_COPY_CHUNK_SIZE = 1024 * 1024
NO_STORE_HEADERS = {"Cache-Control": "no-store"}
CAPABILITY_PROFILE_NAMES = ("default", "experimental", "document-charts-maps")


async def _write_upload_to_path(file: UploadFile, target: Path) -> int:
    bytes_written = 0
    with open(target, "wb") as f:
        while chunk := await file.read(UPLOAD_COPY_CHUNK_SIZE):
            bytes_written += len(chunk)
            f.write(chunk)
    return bytes_written


def _normalize_config_string(value: Any) -> str | None:
    if isinstance(value, (int, float)):
        return str(value)
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _write_ai_settings_to_toml(config_path: Path, payload: dict[str, Any]) -> None:
    """Write ``[ai]`` settings into a TOML config file.

    Preserves unrelated sections and merges provider entries so existing
    ``api_key_env`` references are not replaced with resolved secret values.
    """
    import tomlkit

    if config_path.exists():
        doc = tomlkit.parse(config_path.read_text(encoding="utf-8"))
    else:
        doc = tomlkit.document()
        config_path.parent.mkdir(parents=True, exist_ok=True)

    settings = payload.get("settings")
    if not isinstance(settings, dict):
        settings = payload

    providers = settings.get("providers") or {}
    if not isinstance(providers, dict):
        raise ValueError("'settings.providers' must be an object.")

    default_provider = _normalize_config_string(payload.get("defaultProvider"))
    default_model = _normalize_config_string(payload.get("defaultModel"))

    existing_by_id: dict[str, dict[str, Any]] = {}
    existing_ai = doc.get("ai")
    if isinstance(existing_ai, dict):
        for entry in existing_ai.get("providers") or []:
            if isinstance(entry, dict):
                provider_id = _normalize_config_string(entry.get("id"))
                if provider_id:
                    existing_by_id[provider_id] = dict(entry)

    ai_table = tomlkit.table()
    if default_provider:
        ai_table.add("default_provider", default_provider)
    if default_model:
        ai_table.add("default_model", default_model)

    providers_aot = tomlkit.aot()
    for provider_id, provider in providers.items():
        if not isinstance(provider, dict):
            continue
        provider_name = _normalize_config_string(provider_id)
        if not provider_name:
            continue

        existing = existing_by_id.get(provider_name, {})
        item = tomlkit.table()
        item.add("id", provider_name)
        item.add("base_url", _normalize_config_string(provider.get("baseUrl")) or "")

        api_key = _normalize_config_string(provider.get("apiKey")) or ""
        api_key_env = _normalize_config_string(existing.get("api_key_env"))
        env_value = os.environ.get(api_key_env, "") if api_key_env else ""
        if api_key_env and (not api_key or api_key == env_value):
            item.add("api_key_env", api_key_env)
        elif api_key:
            item.add("api_key", api_key)

        models = tomlkit.array()
        models.multiline(False)
        for model in provider.get("models") or []:
            if not isinstance(model, dict):
                continue
            model_name = _normalize_config_string(model.get("modelName"))
            if model_name:
                models.append(model_name)
        item.add("models", models)
        providers_aot.append(item)
    ai_table.add("providers", providers_aot)

    custom_models_raw = settings.get("customModels") or []
    if not isinstance(custom_models_raw, list):
        raise ValueError("'settings.customModels' must be an array.")
    custom_models_aot = tomlkit.aot()
    for custom_model in custom_models_raw:
        if not isinstance(custom_model, dict):
            continue
        model_name = _normalize_config_string(custom_model.get("modelName"))
        base_url = _normalize_config_string(custom_model.get("baseUrl"))
        if not model_name or not base_url:
            continue
        item = tomlkit.table()
        item.add("model_name", model_name)
        item.add("base_url", base_url)
        api_key = _normalize_config_string(custom_model.get("apiKey"))
        if api_key:
            item.add("api_key", api_key)
        custom_models_aot.append(item)
    if custom_models_aot:
        ai_table.add("custom_models", custom_models_aot)

    model_parameters = settings.get("modelParameters") or {}
    if isinstance(model_parameters, dict):
        params_table = tomlkit.table()
        if "maxSteps" in model_parameters:
            max_steps = model_parameters.get("maxSteps")
            if not isinstance(max_steps, int) or isinstance(max_steps, bool):
                raise ValueError(
                    "'settings.modelParameters.maxSteps' must be an integer."
                )
            params_table.add("max_steps", max_steps)
        additional_instruction = model_parameters.get("additionalInstruction")
        if isinstance(additional_instruction, str):
            params_table.add("additional_instruction", additional_instruction)
        if params_table:
            ai_table.add("model_parameters", params_table)

    if "ai" in doc:
        del doc["ai"]
    doc.add("ai", ai_table)

    raw = tomlkit.dumps(doc)
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    config_path.write_text(raw, encoding="utf-8")


def _write_db_connectors_to_toml(
    config_path: Path, connections: list[dict[str, Any]]
) -> None:
    """Write ``[[db.connectors]]`` entries into a TOML config file.

    Merges incoming connection metadata with existing TOML entries so that
    engine-specific fields the frontend doesn't know about (e.g.
    ``account``, ``password``) are preserved.  Connections whose ``id`` is no
    longer present in *connections* are removed.

    Preserves all non-``[db]`` sections.  If the file does not exist yet it is
    created.
    """
    import tomlkit

    if config_path.exists():
        doc = tomlkit.parse(config_path.read_text(encoding="utf-8"))
    else:
        doc = tomlkit.document()
        config_path.parent.mkdir(parents=True, exist_ok=True)

    existing_by_id: dict[str, dict[str, Any]] = {}
    if "db" in doc and "connectors" in doc["db"]:
        for entry in doc["db"]["connectors"]:
            eid = entry.get("id")
            if eid:
                existing_by_id[eid] = dict(entry)

    frontend_to_toml = {
        "engineId": "engine",
        "runtimeSupport": None,
        "requiresBridge": None,
        "bridgeId": None,
        "isCore": None,
        "config": None,
    }

    from .db_bridge import ENGINE_CONFIG_FIELDS

    all_engine_keys: set[str] = set()
    engine_to_keys: dict[str, set[str]] = {}
    for eng, fields in ENGINE_CONFIG_FIELDS.items():
        keys = {f["key"] for f in fields}
        engine_to_keys[eng] = keys
        all_engine_keys |= keys

    connectors_aot = tomlkit.aot()
    for conn in connections:
        conn_id = conn.get("id")
        base = dict(existing_by_id.get(conn_id, {})) if conn_id else {}

        old_engine = base.get("engine")
        new_engine = conn.get("engineId") or old_engine

        for k, v in conn.items():
            if v is None:
                continue
            toml_key = frontend_to_toml.get(k, k)
            if toml_key is None:
                continue
            base[toml_key] = v

        if old_engine and new_engine and old_engine != new_engine:
            stale_keys = engine_to_keys.get(old_engine, set()) - engine_to_keys.get(
                new_engine, set()
            )
            for sk in stale_keys:
                base.pop(sk, None)

        engine_config = conn.get("config")
        if isinstance(engine_config, dict):
            for ck, cv in engine_config.items():
                if cv is not None and cv != "":
                    base[ck] = cv
                else:
                    base.pop(ck, None)

        item = tomlkit.table()
        for k, v in base.items():
            item.add(k, v)
        connectors_aot.append(item)

    if "db" not in doc:
        doc.add("db", tomlkit.table())
    db_section = doc["db"]
    if "connectors" in db_section:
        del db_section["connectors"]  # type: ignore[arg-type]
    db_section["connectors"] = connectors_aot  # type: ignore[index]

    raw = tomlkit.dumps(doc)
    # Collapse runs of blank lines that tomlkit may accumulate on repeated writes
    import re

    raw = re.sub(r"\n{3,}", "\n\n", raw)
    config_path.write_text(raw, encoding="utf-8")


def _sanitize_filename(name: str) -> str:
    safe = os.path.basename(name.strip().replace("\\", "/"))
    return safe or "upload.dat"


def _localhost_probe_hosts(host: str) -> tuple[str, ...]:
    return ("127.0.0.1", "::1") if host == "localhost" else (host,)


def _can_bind_single_host_port(
    host: str,
    port: int,
    *,
    ignore_unavailable: bool = False,
) -> bool:
    is_ipv6 = ":" in host and host != "0.0.0.0"
    family = socket.AF_INET6 if is_ipv6 else socket.AF_INET
    sock = socket.socket(family, socket.SOCK_STREAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        if family == socket.AF_INET6:
            sock.bind((host, port, 0, 0))
        else:
            sock.bind((host, port))
        return True
    except OSError as exc:
        if exc.errno in {errno.EADDRINUSE, errno.EACCES}:
            return False
        if ignore_unavailable and exc.errno in {
            errno.EADDRNOTAVAIL,
            errno.EAFNOSUPPORT,
        }:
            return True
        raise
    finally:
        sock.close()


def _can_bind_port(host: str, port: int) -> bool:
    return all(
        _can_bind_single_host_port(
            probe_host,
            port,
            ignore_unavailable=host == "localhost",
        )
        for probe_host in _localhost_probe_hosts(host)
    )


def _pick_free_port(
    host: str,
    start_port: int | None = None,
    *,
    reserved_ports: set[int] | None = None,
) -> int:
    """
    Pick an available TCP port for a local background server.

    If ``start_port`` is provided, scan upward from that port. Otherwise bind to
    port 0 and let the OS select a free port.
    """
    is_ipv6 = ":" in host and host != "0.0.0.0"
    family = socket.AF_INET6 if is_ipv6 else socket.AF_INET
    reserved = reserved_ports or set()
    if start_port is not None:
        for port in range(start_port, 65536):
            if port in reserved:
                continue
            if _can_bind_port(host, port):
                return port
        raise RuntimeError(f"No available port found starting from {start_port}.")

    sockets = []
    try:
        # Keep rejected sockets open so the OS cannot select the same reserved
        # ephemeral port again on the next attempt.
        for _attempt in range(len(reserved) + 1):
            sock = socket.socket(family, socket.SOCK_STREAM)
            sockets.append(sock)
            if family == socket.AF_INET6:
                sock.bind((host, 0, 0, 0))
            else:
                sock.bind((host, 0))
            port = int(sock.getsockname()[1])
            if port not in reserved:
                return port
        raise RuntimeError("No unreserved ephemeral port was available.")
    finally:
        for sock in sockets:
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


def _derive_ws_proxy_url(external_url: str) -> str:
    parsed = urlsplit(external_url.rstrip("/"))
    scheme = {"http": "ws", "https": "wss"}.get(parsed.scheme, parsed.scheme)
    base_path = parsed.path.rstrip("/")
    return urlunsplit((scheme, parsed.netloc, f"{base_path}/ws/duckdb", "", ""))


class SqlroomsHttpServer:
    def __init__(
        self,
        db_path: str | Path,
        host: str,
        port: int,
        ws_port: int | None = None,
        *,
        sync_enabled: bool = False,
        meta_db: str | None = None,
        meta_namespace: str = "__sqlrooms",
        llm_provider: str | None = None,
        llm_model: str | None = None,
        api_key: str | None = None,
        ai_providers: dict[str, dict[str, Any]] | None = None,
        ai_custom_models: list[dict[str, Any]] | None = None,
        ai_model_parameters: dict[str, Any] | None = None,
        connector_settings: list[PostgresConnectorSettings | SnowflakeConnectorSettings]
        | None = None,
        open_browser: bool = True,
        ui_dir: str | None = None,
        serve_ui: bool = True,
        experimental_enabled: bool = False,
        capability_profile: str | None = None,
        config_path: Path | None = None,
        external_url: str | None = None,
        external_ws_url: str | None = None,
        ai_devtools: bool = False,
        execution_mode: str = "embedded",
        mcp_enabled: bool = False,
        mcp_port: int | None = None,
        debug: bool = False,
    ):
        db_path_str = str(db_path)
        self.is_in_memory = db_path_str == ":memory:"
        if self.is_in_memory:
            self.db_path: Path | None = None
            self.duckdb_database = ":memory:"
            base_dir = Path(tempfile.gettempdir()) / "sqlrooms"
        else:
            self.db_path = Path(db_path).expanduser().resolve()
            self.duckdb_database = str(self.db_path)
            base_dir = self.db_path.parent

        if host not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError(
                "SQLRooms local authentication requires a loopback bind host."
            )
        self.host = host
        self.port = port
        self.external_url = (
            normalize_transport_url(external_url).rstrip("/") if external_url else None
        )
        if self.external_url and urlsplit(self.external_url).scheme not in {
            "http",
            "https",
        }:
            raise ValueError("--external-url requires an HTTP or HTTPS URL.")
        self.external_ws_url = (
            normalize_transport_url(external_ws_url) if external_ws_url else None
        )
        expected_ws_url = _derive_ws_proxy_url(self.external_url or self._ui_url())
        if self.external_ws_url and self.external_ws_url != normalize_transport_url(
            expected_ws_url
        ):
            raise ValueError(
                "--external-ws-url must use the page's /ws/duckdb route. "
                "Split WebSocket endpoints are unsupported with local authentication; "
                "omit --external-ws-url and proxy HTTP and WebSockets together."
            )
        if ws_port is not None or mcp_port is not None:
            raise ValueError(
                "--ws-port and --mcp-port were removed; use --port for HTTP, /ws/duckdb and /mcp."
            )
        self.llm_provider = llm_provider
        self.llm_model = llm_model
        self.api_key = api_key
        self.ai_providers = ai_providers or {}
        self.ai_custom_models = ai_custom_models or []
        self.ai_model_parameters = ai_model_parameters or {}
        self.open_browser = open_browser
        self.serve_ui = serve_ui
        resolved_capability_profile = (
            capability_profile
            if capability_profile is not None
            else ("experimental" if experimental_enabled else "default")
        )
        if resolved_capability_profile not in CAPABILITY_PROFILE_NAMES:
            expected = ", ".join(CAPABILITY_PROFILE_NAMES)
            raise ValueError(
                f"Unknown SQLRooms capability profile '{resolved_capability_profile}'. "
                f"Expected one of: {expected}."
            )
        if experimental_enabled and resolved_capability_profile != "experimental":
            raise ValueError(
                "experimental_enabled conflicts with capability_profile "
                f"'{resolved_capability_profile}'."
            )
        self.capability_profile = resolved_capability_profile
        if sync_enabled and self.capability_profile != "experimental":
            raise ValueError("sync_enabled requires capability_profile 'experimental'.")
        self.experimental_enabled = self.capability_profile == "experimental"
        self.ai_devtools = bool(ai_devtools)
        self.execution_mode = execution_mode
        self.mcp_enabled_default = bool(mcp_enabled)
        self.debug = bool(debug)
        self.sync_enabled = bool(sync_enabled)
        self.meta_db = meta_db
        self.meta_namespace = meta_namespace
        self.access = LocalAccess()
        self.session_token = self.access.native_token
        self.credential_file = None
        self.db_bridge_registry = build_cli_db_bridge_registry(
            bridge_id=DB_BRIDGE_ID,
            connector_settings=connector_settings,
        )
        self.config_path = config_path
        self.connector_settings = connector_settings or []
        self.ui_provider: UiProvider = (
            DirectoryUiProvider(ui_dir) if ui_dir else BuiltinUiProvider()
        )
        self.static_dir = self.ui_provider.static_dir()
        self.index_html = self.ui_provider.index_html()
        self.upload_dir = base_dir / "sqlrooms_uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.runtime = DuckDBRuntime(
            self.duckdb_database,
            self.upload_dir,
            meta_namespace=self.meta_namespace,
            meta_db_path=self.meta_db,
        )
        origins = {
            f"http://{host}:{self.port}" for host in ("127.0.0.1", "localhost", "[::1]")
        }
        if self.external_url:
            parsed = urlsplit(self.external_url)
            origins.add(f"{parsed.scheme}://{parsed.netloc}")
        # A dev proxy must be named explicitly, including its exact port.
        origins.update(
            filter(None, os.environ.get("SQLROOMS_ALLOWED_ORIGINS", "").split(","))
        )
        origins = {
            normalize_transport_url(origin.strip()).rstrip("/") for origin in origins
        }
        hosts = {urlsplit(origin).netloc for origin in origins}
        self.security = TransportSecurity(self.access, origins, hosts)
        self.mcp_security = self.security
        self.mcp_broker = McpBridgeBroker(self.session_token, security=self.security)
        self.mcp_service = SqlroomsMcpService(
            self.mcp_broker, security=self.mcp_security
        )
        self.mcp_service.enabled = False
        self._mcp_last_error: str | None = None
        self._app_resources = None

        from ..agent.runtime import Runtime

        self.agent_runtime = Runtime(self)
        self.mcp_broker.agent_runtime = self.agent_runtime

    async def start(
        self, session: Callable[[], Awaitable[int]] | None = None
    ) -> int | None:
        self._assert_ui_available()
        self._reserved_http_socket = None
        try:
            native_required = (
                session is not None
                or not self.serve_ui
                or self.mcp_enabled_default
                or self.agent_runtime.managed
            )
            if native_required and not supports_private_credentials():
                raise RuntimeError(
                    "Native integrations require owner-only credential storage; Windows ACL support is not yet available."
                )
            if self.agent_runtime.managed:
                from ..agent.process import reserve_managed_listeners

                self._reserved_http_socket = reserve_managed_listeners(self)
            if supports_private_credentials():
                self.credential_file = CredentialFile(
                    self.access,
                    self._ui_url(),
                    self._mcp_url(),
                    self._ws_proxy_url(),
                )
            return await self._serve(session)
        finally:
            from ..agent.registry import remove

            if self.credential_file:
                remove(self.access.binding)
            self.access.invalidate()
            await self._stop_mcp()
            await self.mcp_broker.close()
            if self.credential_file:
                self.credential_file.close()
            if self._reserved_http_socket:
                self._reserved_http_socket.close()

    async def _serve(
        self, session: Callable[[], Awaitable[int]] | None = None
    ) -> int | None:
        logger.info("Starting sqlrooms CLI server")
        self._assert_ui_available()
        if self.meta_db:
            logger.debug(
                "Meta DB is ENABLED (db=%s, namespace=%s)",
                self.meta_db,
                self.meta_namespace,
            )
        else:
            logger.debug(
                "Meta DB is DISABLED (using schema=%s within main DB)",
                self.meta_namespace,
            )
        if self.sync_enabled:
            logger.info("CRDT sync is ENABLED")
        if self.credential_file:
            logger.info("Native credential file: %s", self.credential_file.path)
        if not self.open_browser and self.serve_ui and sys.stderr.isatty():
            print(
                "Temporary single-use SQLRooms launch link (valid 2 minutes): "
                + self._launch_url(),
                file=sys.stderr,
            )
        app = self._build_app()

        browser_timer = None
        if self.open_browser and self.serve_ui:
            browser_timer = threading.Timer(1.0, self._open_browser)
            browser_timer.start()

        logger.info("SQLRooms UI URL: %s", self._ui_url())
        logger.info("DuckDB websocket URL: %s", self._ws_url())

        config = uvicorn.Config(
            app,
            host=self.host,
            port=self.port,
            log_level="warning",
            access_log=False,
            **UVICORN_OPTIONS,
        )
        server = uvicorn.Server(config)
        self._http_server = server
        session_task = None
        http_task = asyncio.create_task(
            server.serve(sockets=[self._reserved_http_socket])
            if self._reserved_http_socket
            else server.serve()
        )

        async def register_when_ready():
            if self.credential_file is None:
                return
            for _ in range(1000):
                if getattr(server, "started", False) and self.runtime.ready:
                    await self.agent_runtime.publish()
                    return
                await asyncio.sleep(0.01)
            raise RuntimeError("Runtime startup timed out.")

        registration_task = asyncio.create_task(register_when_ready())
        try:
            if session is not None:

                async def ready_session():
                    await registration_task
                    return await session()

                session_task = asyncio.create_task(ready_session())
            watched = {http_task, registration_task}
            if session_task:
                watched.add(session_task)
            while watched:
                done, _ = await asyncio.wait(
                    watched, return_when=asyncio.FIRST_COMPLETED
                )
                if session_task in done:
                    return await session_task
                if http_task in done:
                    await http_task
                    if self._app_resources.start_error:
                        raise RuntimeError(
                            "Database/application startup failed"
                        ) from self._app_resources.start_error
                    return None
                if registration_task in done:
                    await registration_task
                    watched.remove(registration_task)
        finally:
            registration_task.cancel()
            await asyncio.gather(registration_task, return_exceptions=True)
            if browser_timer:
                browser_timer.cancel()
            if session_task and not session_task.done():
                session_task.cancel()
                await asyncio.gather(session_task, return_exceptions=True)
            server.should_exit = True
            try:
                await asyncio.wait_for(
                    asyncio.shield(asyncio.gather(http_task, return_exceptions=True)),
                    timeout=5,
                )
            except asyncio.TimeoutError:
                http_task.cancel()
                await asyncio.gather(http_task, return_exceptions=True)
            if self._app_resources and self._app_resources.failure:
                raise RuntimeError(
                    "Workspace persistence failed during shutdown"
                ) from self._app_resources.failure

    async def _start_mcp(self) -> Dict[str, Any]:
        if not supports_private_credentials():
            raise RuntimeError(
                "Native MCP requires owner-only credential storage; Windows ACL support is not yet available."
            )
        self.mcp_service.enabled = True
        return self._mcp_status()

    async def _stop_mcp(self) -> Dict[str, Any]:
        self.mcp_service.enabled = False
        return self._mcp_status()

    @asynccontextmanager
    async def _application_lifespan(self, app):
        # Explicitly enter the SDK lifespan; mounting/routing alone does not run it.
        try:
            async with self.mcp_service.lifespan():
                if self.mcp_enabled_default:
                    await self._start_mcp()
                yield
        finally:
            await self._stop_mcp()
            await self.mcp_broker.close()

    def _mcp_status(self) -> Dict[str, Any]:
        running = self.mcp_service.enabled
        bridge = self.mcp_broker.status()
        if self._mcp_last_error:
            status = "error"
        elif not running:
            status = "off"
        elif bridge["status"] != "ready":
            status = "waiting"
        elif bridge["pendingRequests"] or bridge["recentActivity"]:
            status = "working"
        else:
            status = "ready"
        return {
            "status": status,
            "enabled": running,
            "url": self._mcp_url(),
            "bridge": bridge,
            "lastError": self._mcp_last_error,
        }

    def _open_browser(self) -> None:
        url = self._launch_url()
        try:
            webbrowser.open_new_tab(url)
        except Exception:
            logger.debug("Failed to open browser")
        else:
            logger.info("Opened authorized SQLRooms browser page")

    def _launch_url(self) -> str:
        return (
            (self.external_url or self._ui_url())
            + "/#sqlrooms-ticket="
            + self.access.ticket()
        )

    def _public_host(self) -> str:
        return (
            "localhost"
            if self.host in ("0.0.0.0", "::", "127.0.0.1", "::1")
            else self.host
        )

    def _ui_host(self) -> str:
        return "localhost" if self.host in ("0.0.0.0", "::") else self.host

    @staticmethod
    def _host_for_url(host: str) -> str:
        if ":" in host and not host.startswith("["):
            return f"[{host}]"
        return host

    def _ui_url(self) -> str:
        return f"http://{self._host_for_url(self._ui_host())}:{self.port}"

    def _ws_url(self) -> str:
        return self.external_ws_url or _derive_ws_proxy_url(
            self.external_url or self._ui_url()
        )

    def _ws_proxy_url(self) -> str:
        return _derive_ws_proxy_url(self._ui_url())

    def _mcp_url(self) -> str:
        return self._ui_url() + "/mcp"

    def _mcp_bridge_url(self) -> str:
        if self.external_url:
            parsed = urlsplit(self.external_url)
            scheme = "wss" if parsed.scheme == "https" else "ws"
            return urlunsplit(
                (
                    scheme,
                    parsed.netloc,
                    f"{parsed.path.rstrip('/')}/ws/mcp-bridge",
                    "",
                    "",
                )
            )
        return f"ws://{self._host_for_url(self._ui_host())}:{self.port}/ws/mcp-bridge"

    def _assert_ui_available(self) -> None:
        if not self.serve_ui:
            return
        if self.index_html.exists():
            return
        if isinstance(self.ui_provider, DirectoryUiProvider):
            raise RuntimeError(
                f"SQLRooms UI bundle is missing: {self.index_html}. "
                "Build the UI bundle or pass --no-ui to start only the API server."
            )
        raise RuntimeError(
            f"Bundled SQLRooms UI is missing from this installation: {self.index_html}. "
            "Reinstall sqlrooms or report a packaging issue. "
            "Developers can rebuild it with `pnpm --filter sqlrooms-python build:ui`."
        )

    def _index_response(self) -> FileResponse:
        return FileResponse(self.index_html, headers=NO_STORE_HEADERS)

    def _resolve_static_file(self, full_path: str) -> Path | None:
        static_root = self.static_dir.resolve()
        candidate = (static_root / full_path).resolve()
        try:
            candidate.relative_to(static_root)
        except ValueError:
            return None
        if candidate.is_file() and candidate.name != "index.html":
            return candidate
        return None

    def _stale_entry_asset_redirect(self, full_path: str) -> RedirectResponse | None:
        requested = Path(full_path)
        if (
            len(requested.parts) != 2
            or requested.parts[0] != "assets"
            or not requested.name.startswith("index-")
            or requested.suffix not in {".css", ".js"}
        ):
            return None

        assets_dir = self.static_dir / "assets"
        matches = sorted(assets_dir.glob(f"index-*{requested.suffix}"))
        if len(matches) != 1:
            return None

        return RedirectResponse(
            # Resolve beside the requested asset so proxies can strip any mount prefix.
            url=f"./{matches[0].name}",
            status_code=302,
            headers=NO_STORE_HEADERS,
        )

    def _runtime_status(self) -> Dict[str, Any]:
        status = "ready" if self.runtime.ready else "starting"
        return {
            "status": "ready" if self.runtime.ready else "degraded",
            "components": {
                "duckdbWebSocket": {"status": status},
                "mcp": self._mcp_status(),
            },
        }

    def _runtime_config(self) -> Dict[str, Any]:
        derived_ws_url = (
            _derive_ws_proxy_url(self.external_url)
            if self.external_url and not self.external_ws_url
            else None
        )
        ws_url = self.external_ws_url or derived_ws_url or self._ws_proxy_url()
        return {
            "wsUrl": ws_url,
            "binding": self.access.binding,
            "apiBaseUrl": self.external_url or "",
            "llmProvider": self.llm_provider,
            "llmModel": self.llm_model,
            "configWritable": self.config_path is not None,
            "capabilityProfile": self.capability_profile,
            "executionMode": self.execution_mode,
            "experimentalEnabled": self.experimental_enabled,
            "aiDevtools": self.ai_devtools,
            "syncEnabled": self.sync_enabled,
            "crdtWsUrl": ws_url,
            "crdtRoomId": (
                f"sqlrooms:{self.meta_namespace}:{self.duckdb_database or 'memory'}"
            ),
            "aiProviders": self.ai_providers
            if self.execution_mode == "embedded"
            else {},
            "aiSettings": {
                "providers": self.ai_providers
                if self.execution_mode == "embedded"
                else {},
                "customModels": self.ai_custom_models
                if self.execution_mode == "embedded"
                else [],
                "modelParameters": self.ai_model_parameters,
            },
            "dbPath": self.duckdb_database,
            "metaNamespace": self.meta_namespace,
            "startupStatus": self._runtime_status(),
            "mcp": {
                "enabled": self._mcp_status()["enabled"],
                "url": self._mcp_url(),
                "bridgeUrl": self._mcp_bridge_url(),
            },
            "dbBridge": {
                "id": self.db_bridge_registry.bridge_id,
                "connections": self.db_bridge_registry.runtime_connections(),
                "diagnostics": self.db_bridge_registry.runtime_diagnostics(),
                "supportedEngines": SUPPORTED_ENGINES,
                "engineConfigFields": ENGINE_CONFIG_FIELDS,
            },
        }

    def _require_api_auth(self, request: Request):
        # Route middleware has already checked the specific operation. Retained
        # for direct route consumers; no loopback exception.
        try:
            self.security.authorize(
                request.headers, getattr(request.state, "access_operation", "read")
            )
        except AccessDenied as exc:
            return JSONResponse(
                {"error": exc.code},
                status_code=401 if exc.code == "unauthorized" else 403,
                headers=NO_STORE,
            )
        return None

    def _require_session_token(self, request: Request):
        return self._require_api_auth(request)

    def _build_app(self) -> FastAPI:
        app = create_app(
            self.runtime,
            self.security,
            title="sqlrooms",
            sync_enabled=self.sync_enabled,
            allow_client_snapshots=self.sync_enabled and self.is_in_memory,
            lifespan=self._application_lifespan,
        )
        self._app_resources = app.state.resources
        app.router.routes.append(Route("/mcp", endpoint=self.mcp_service))
        self.agent_runtime.routes(app)
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(self.security.origins),
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type", "X-SQLRooms-Token"],
        )

        @app.middleware("http")
        async def add_cross_origin_isolation_headers(request: Request, call_next):
            path = request.url.path
            try:
                self.security.check_headers(request.headers)
                if request.method == "OPTIONS" and request.headers.get(
                    "access-control-request-method"
                ):
                    pass  # CORS handles allowed preflights after Host/Origin validation.
                elif path in {"/api/config", "/config.json"}:
                    self.security.authorize(request.headers, "page-config")
                elif (
                    path.startswith("/api/")
                    and path != "/api/auth/exchange"
                    or path == "/status.json"
                ):
                    operation = "read"
                    if path == "/api/auth/renew":
                        operation = "renew"
                    elif path == "/api/auth/ticket":
                        operation = "bootstrap"
                    elif (
                        path in {"/api/ai/settings", "/api/db/settings"}
                        and request.method == "PUT"
                    ):
                        operation = "config-write"
                    elif path.startswith("/api/agent/") or path.startswith(
                        "/api/workspaces"
                    ):
                        operation = "read" if request.method == "GET" else "control"
                    elif path in {"/api/mcp/start", "/api/mcp/stop"}:
                        operation = "control"
                    elif request.method not in {"GET", "HEAD", "OPTIONS"}:
                        operation = "query"
                    if self.agent_runtime.stopping and operation in {
                        "query",
                        "config-write",
                    }:
                        raise AccessDenied("workspace_closing")
                    request.state.access_operation = operation
                    self.security.authorize(request.headers, operation)
                response = await call_next(request)
            except AccessDenied as exc:
                response = JSONResponse(
                    {"error": exc.code},
                    status_code=401 if exc.code == "unauthorized" else 403,
                )
            response.headers.update(NO_STORE)
            # WebContainer requires cross-origin isolation to transfer SharedArrayBuffer.
            response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
            response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
            response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
            return response

        @app.get("/auth.json")
        async def identity():
            return {"binding": self.access.binding}

        @app.post("/api/auth/exchange")
        async def exchange(request: Request):
            # Bound the unauthenticated body before JSON decoding.
            data = bytearray()
            async for chunk in request.stream():
                data.extend(chunk)
                if len(data) > 4096:
                    raise AccessDenied()
            try:
                payload = json.loads(data)
                ticket = payload.get("ticket")
                if not isinstance(ticket, str):
                    raise AccessDenied()
                return self.access.redeem(ticket)
            except (ValueError, AttributeError):
                raise AccessDenied()

        @app.post("/api/auth/renew")
        async def renew(request: Request):
            return self.access.renew(bearer(request.headers))

        @app.post("/api/auth/ticket")
        async def ticket():
            return {"url": self._launch_url()}

        @app.get("/api/config")
        async def get_config():
            return self._runtime_config()

        @app.get("/config.json")
        async def get_config_json():
            return self._runtime_config()

        @app.websocket("/ws/mcp-bridge")
        async def mcp_browser_bridge(client_ws: WebSocket):
            await self.mcp_broker.handle_websocket(client_ws)

        @app.get("/api/status")
        async def get_status():
            return self._runtime_status()

        @app.get("/status.json")
        async def get_status_json():
            return self._runtime_status()

        @app.get("/api/mcp/status")
        async def get_mcp_status(request: Request):
            unauthorized = self._require_session_token(request)
            if unauthorized is not None:
                return unauthorized
            return self._mcp_status()

        @app.post("/api/mcp/start")
        async def start_mcp(request: Request):
            unauthorized = self._require_session_token(request)
            if unauthorized is not None:
                return unauthorized
            try:
                return await self._start_mcp()
            except Exception as exc:
                self._mcp_last_error = str(exc)
                return JSONResponse(self._mcp_status(), status_code=500)

        @app.post("/api/mcp/stop")
        async def stop_mcp(request: Request):
            unauthorized = self._require_session_token(request)
            if unauthorized is not None:
                return unauthorized
            return await self._stop_mcp()

        @app.get("/api/db/settings")
        async def get_db_settings():
            connections = self.db_bridge_registry.runtime_connections()
            diagnostics = self.db_bridge_registry.runtime_diagnostics()
            return {
                "connections": connections,
                "diagnostics": diagnostics,
                "supportedEngines": SUPPORTED_ENGINES,
                "engineConfigFields": ENGINE_CONFIG_FIELDS,
            }

        @app.put("/api/db/settings")
        async def put_db_settings(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
            if self.config_path is None:
                return JSONResponse(
                    {
                        "error": "No config file available (started with --no-config or no config found)."
                    },
                    status_code=400,
                )
            connections = payload.get("connections")
            if not isinstance(connections, list):
                return JSONResponse(
                    {"error": "'connections' must be an array."},
                    status_code=400,
                )
            try:
                _write_db_connectors_to_toml(self.config_path, connections)
            except Exception:
                logger.error("Failed to write db settings to %s", self.config_path)
                return JSONResponse({"error": "Operation failed"}, status_code=500)
            return {"ok": True, "configPath": str(self.config_path)}

        @app.put("/api/ai/settings")
        async def put_ai_settings(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
            if self.config_path is None:
                return JSONResponse(
                    {
                        "error": "No config file available (started with --no-config or no config found)."
                    },
                    status_code=400,
                )
            try:
                _write_ai_settings_to_toml(self.config_path, payload)
            except ValueError as exc:
                return JSONResponse({"error": str(exc)}, status_code=400)
            except Exception:
                logger.error("Failed to write AI settings to %s", self.config_path)
                return JSONResponse({"error": "Operation failed"}, status_code=500)

            settings = payload.get("settings")
            if isinstance(settings, dict):
                providers = settings.get("providers")
                custom_models = settings.get("customModels")
                model_parameters = settings.get("modelParameters")
                if isinstance(providers, dict):
                    self.ai_providers = providers
                if isinstance(custom_models, list):
                    self.ai_custom_models = custom_models
                if isinstance(model_parameters, dict):
                    self.ai_model_parameters = model_parameters
            default_provider = _normalize_config_string(payload.get("defaultProvider"))
            default_model = _normalize_config_string(payload.get("defaultModel"))
            if default_provider:
                self.llm_provider = default_provider
            if default_model:
                self.llm_model = default_model
            return {"ok": True, "configPath": str(self.config_path)}

        from .local_file import resolve_local_file

        # The existing API middleware requires a verified query-capable caller.
        app.add_api_route("/api/local-file", resolve_local_file, methods=["POST"])

        @app.post("/api/upload")
        async def upload_file(request: Request, file: UploadFile = File(...)):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
            safe_name = _sanitize_filename(file.filename)
            target = self.upload_dir / safe_name
            await _write_upload_to_path(file, target)
            return {"path": str(target)}

        @app.post("/api/db/test-connection")
        async def test_connection(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
            connection_id = payload.get("connectionId")
            engine = payload.get("engine")
            config = payload.get("config")

            try:
                if isinstance(engine, str) and isinstance(config, dict):
                    connector = build_ephemeral_connector(engine, config)
                    ok = connector.test_connection()
                    return {"ok": bool(ok)}

                if isinstance(connection_id, str) and connection_id.strip():
                    ok = self.db_bridge_registry.test_connection(connection_id)
                    return {"ok": bool(ok)}

                return {
                    "ok": False,
                    "error": "Provide either engine+config or connectionId",
                }
            except UnknownBridgeConnectionError:
                return {"ok": False, "error": "Operation failed"}
            except Exception:
                return {"ok": False, "error": "Operation failed"}

        @app.post("/api/db/list-catalog")
        async def list_catalog(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
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
            except UnknownBridgeConnectionError:
                return {
                    "databases": [],
                    "schemas": [],
                    "tables": [],
                    "error": "Operation failed",
                }
            except Exception:
                return {
                    "databases": [],
                    "schemas": [],
                    "tables": [],
                    "error": "Operation failed",
                }

        @app.post("/api/db/execute-query")
        async def execute_query(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
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
            except UnknownBridgeConnectionError:
                return JSONResponse({"error": "Operation failed"}, status_code=404)
            except Exception:
                return JSONResponse({"error": "Operation failed"}, status_code=500)

        @app.post("/api/db/fetch-arrow")
        async def fetch_arrow(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
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
            except UnknownBridgeConnectionError:
                return JSONResponse({"error": "Operation failed"}, status_code=404)
            except Exception:
                return JSONResponse({"error": "Operation failed"}, status_code=500)

        @app.post("/api/db/fetch-arrow-stream")
        async def fetch_arrow_stream(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
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
                except UnknownBridgeConnectionError:
                    yield _encode_stream_frame(
                        "error", query_id=query_id, error="Database operation failed"
                    )
                except Exception:
                    yield _encode_stream_frame(
                        "error", query_id=query_id, error="Database operation failed"
                    )

            return StreamingResponse(_stream(), media_type="application/octet-stream")

        @app.post("/api/db/cancel-query")
        async def cancel_query(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
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
        async def project_query(payload: Dict[str, Any], request: Request):
            unauthorized = self._require_api_auth(request)
            if unauthorized is not None:
                return unauthorized
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
                data = await self.runtime.run_db_task(_run)
            except Exception:
                return JSONResponse({"error": "Operation failed"}, status_code=400)
            return data

        if self.serve_ui and self.static_dir.exists():

            @app.api_route("/", methods=["GET", "HEAD"])
            async def spa_index():
                return self._index_response()

            @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
            async def spa_fallback(full_path: str):
                static_file = self._resolve_static_file(full_path)
                if static_file is not None:
                    return FileResponse(static_file)

                stale_entry_redirect = self._stale_entry_asset_redirect(full_path)
                if stale_entry_redirect is not None:
                    return stale_entry_redirect

                if full_path == "api" or full_path.startswith("api/"):
                    return JSONResponse(
                        {"error": "Endpoint not found"}, status_code=404
                    )

                if full_path.startswith("assets/"):
                    return JSONResponse(
                        {"error": "Static asset not found"}, status_code=404
                    )

                if self.index_html.exists():
                    return self._index_response()
                return JSONResponse({"error": "UI bundle not found"}, status_code=404)
        elif self.serve_ui:
            logger.warning(
                "Static bundle missing at %s. UI will not load until built.",
                self.index_html,
            )
        else:
            logger.info(
                "Static UI serving is disabled; API endpoints remain available."
            )

        return app
