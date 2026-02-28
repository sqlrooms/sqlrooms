from __future__ import annotations

import asyncio
import hashlib
import logging
import json
import os
import re
from pathlib import Path
import sys
from typing import Any

from click.core import ParameterSource
import duckdb
import typer

from .web.db_bridge import SnowflakeConnectorSettings
from .web.launcher import SqlroomsHttpServer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = typer.Typer(
    add_completion=False,
    pretty_exceptions_enable=False,
    invoke_without_command=True,
)


def _normalize_config_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _default_config_candidates() -> list[Path]:
    home = Path.home()
    candidates: list[Path] = []
    if sys.platform.startswith("win"):
        appdata = os.environ.get("APPDATA")
        if appdata:
            candidates.append(Path(appdata) / "sqlrooms" / "config.toml")
        candidates.append(home / ".sqlrooms" / "config.toml")
        return candidates

    xdg_home = os.environ.get("XDG_CONFIG_HOME")
    if xdg_home:
        candidates.append(Path(xdg_home) / "sqlrooms" / "config.toml")
    else:
        candidates.append(home / ".config" / "sqlrooms" / "config.toml")
    candidates.append(home / ".sqlrooms" / "config.toml")
    return candidates


def _resolve_config_path(explicit_path: str | None, no_config: bool) -> Path | None:
    if no_config:
        return None
    if explicit_path:
        candidate = Path(explicit_path).expanduser()
        if candidate.exists():
            return candidate
        raise RuntimeError(f"SQLRooms config file not found: {candidate}")
    for candidate in _default_config_candidates():
        expanded = candidate.expanduser()
        if expanded.exists():
            return expanded
    return None


def _read_toml(path: Path) -> dict[str, Any]:
    try:
        import tomllib  # type: ignore[attr-defined]
    except ModuleNotFoundError:
        import tomli as tomllib  # type: ignore[no-redef]
    with path.open("rb") as fh:
        data = tomllib.load(fh)
    if not isinstance(data, dict):
        raise RuntimeError(f"SQLRooms config must be a TOML object: {path}")
    return data


def _load_connector_config(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    raw = _read_toml(path)
    connectors = raw.get("connectors")
    if not isinstance(connectors, dict):
        return {}

    out: dict[str, str] = {}
    postgres = connectors.get("postgres")
    if isinstance(postgres, dict):
        dsn = _normalize_config_string(postgres.get("dsn"))
        if dsn:
            out["postgres_dsn"] = dsn
        connection_id = _normalize_config_string(postgres.get("connection_id"))
        if connection_id:
            out["postgres_connection_id"] = connection_id
        title = _normalize_config_string(postgres.get("title"))
        if title:
            out["postgres_title"] = title

    snowflake = connectors.get("snowflake")
    if isinstance(snowflake, dict):
        for key in (
            "account",
            "user",
            "password",
            "warehouse",
            "database",
            "schema",
            "role",
            "authenticator",
            "connection_id",
            "title",
        ):
            value = _normalize_config_string(snowflake.get(key))
            if value:
                out[f"snowflake_{key}"] = value
    logger.info("Loaded SQLRooms connector config from %s", path)
    return out


@app.command("export")
def export_project(
    db_path: str = typer.Argument(
        ...,
        help="DuckDB project file to export from.",
    ),
    out_dir: str = typer.Option(
        "./out",
        "--dir",
        help="Output directory for exported artifacts.",
    ),
    meta_namespace: str = typer.Option(
        "__sqlrooms",
        "--meta-namespace",
        help="Namespace for SQLRooms meta tables.",
    ),
):
    """
    Export app-builder files stored in persisted UI state to a directory.
    """
    out = Path(out_dir).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(db_path)
    try:
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", meta_namespace):
            typer.echo(
                f"Invalid --meta-namespace value: {meta_namespace!r}",
                err=True,
            )
            raise typer.Exit(code=1)
        ui_ref = f'"{meta_namespace}"."ui_state"'
        row = con.execute(
            f"SELECT payload_json FROM {ui_ref} WHERE key = 'default' LIMIT 1"
        ).fetchone()
        if not row:
            typer.echo("No persisted ui_state found; nothing to export.")
            return
        payload = row[0]
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError as exc:
                typer.echo(
                    f"Failed to parse payload_json from {ui_ref}: {exc}",
                    err=True,
                )
                raise typer.Exit(code=1) from exc
        if not isinstance(payload, dict):
            typer.echo(
                "Invalid payload_json format: expected a JSON object.",
                err=True,
            )
            raise typer.Exit(code=1)

        app_project = (payload or {}).get("appProject") or {}
        config = app_project.get("config") or {}
        apps_by_sheet = config.get("appsBySheetId") or {}
        exported = 0
        for sheet_id, sheet_app in apps_by_sheet.items():
            files = (sheet_app or {}).get("files") or {}
            if not isinstance(files, dict) or len(files) == 0:
                continue
            safe_sheet_id = "".join(
                ch for ch in str(sheet_id) if ch.isalnum() or ch in ("-", "_")
            )
            if not safe_sheet_id:
                safe_sheet_id = hashlib.sha1(
                    str(sheet_id).encode("utf-8")
                ).hexdigest()[:8]
            name = str((sheet_app or {}).get("name") or sheet_id)
            safe_name = "".join(
                ch for ch in name if ch.isalnum() or ch in ("-", "_", " ")
            ).strip()
            safe_name = safe_name.replace(" ", "-") or safe_sheet_id
            root = out / f"{safe_name}-{safe_sheet_id[:8]}"
            root_resolved = root.resolve()
            try:
                root_resolved.relative_to(out)
            except ValueError:
                typer.echo(
                    f"Unsafe export root path resolved outside output dir: {root_resolved}",
                    err=True,
                )
                raise typer.Exit(code=1)
            root.mkdir(parents=True, exist_ok=True)
            meta = {
                "sheetId": sheet_id,
                "name": name,
                "prompt": (sheet_app or {}).get("prompt", ""),
                "template": (sheet_app or {}).get("template", ""),
                "updatedAt": (sheet_app or {}).get("updatedAt"),
            }
            (root / "app.json").write_text(
                json.dumps(meta, indent=2), encoding="utf-8"
            )
            for path, content in files.items():
                rel = Path(str(path).lstrip("/"))
                target = (root / rel).resolve()
                try:
                    target.relative_to(root_resolved)
                except ValueError:
                    typer.echo(
                        f"Skipping unsafe export path outside target directory: {path!r}",
                        err=True,
                    )
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(str(content), encoding="utf-8")
            exported += 1
        if exported == 0:
            typer.echo("No app-builder files found in ui_state.")
            return
        typer.echo(f"Exported artifacts to {out}")
    finally:
        con.close()


@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    db_path: str | None = typer.Argument(
        None,
        help="DuckDB database to use (positional). Pass a filepath to persist, or ':memory:' for an in-memory DB (no file).",
    ),
    db_path_option: str = typer.Option(
        ":memory:",
        "--db-path",
        "-d",
        help="DuckDB database to use (flag). Defaults to ':memory:'.",
        show_default=True,
    ),
    host: str = typer.Option("127.0.0.1", "--host", help="HTTP host for the UI."),
    port: int = typer.Option(4173, "--port", help="HTTP port for the UI."),
    ws_port: int | None = typer.Option(
        None,
        "--ws-port",
        help="WebSocket port for DuckDB queries. If omitted, a free port is chosen automatically.",
    ),
    llm_provider: str = typer.Option(
        "openai", "--llm-provider", help="Default LLM provider (e.g. openai, ollama)."
    ),
    llm_model: str = typer.Option(
        "gpt-4o-mini",
        "--llm-model",
        help="Default model name passed to the AI tools.",
    ),
    api_key: str = typer.Option(
        None,
        "--api-key",
        envvar="SQLROOMS_API_KEY",
        help="API key for the chosen LLM provider.",
    ),
    config: str | None = typer.Option(
        None,
        "--config",
        envvar="SQLROOMS_CONFIG",
        help="Path to a SQLRooms TOML config file. Defaults to platform config paths when present.",
    ),
    no_config: bool = typer.Option(
        False,
        "--no-config",
        help="Disable loading connector settings from config file.",
    ),
    postgres_dsn: str | None = typer.Option(
        None,
        "--postgres-dsn",
        envvar="SQLROOMS_POSTGRES_DSN",
        help="Optional Postgres DSN to enable backend connector bridge testing in CLI mode.",
    ),
    postgres_connection_id: str = typer.Option(
        "postgres-default",
        "--postgres-connection-id",
        envvar="SQLROOMS_POSTGRES_CONNECTION_ID",
        help="Connection id exposed to DbSlice for the Postgres bridge.",
    ),
    postgres_title: str = typer.Option(
        "Postgres",
        "--postgres-title",
        envvar="SQLROOMS_POSTGRES_TITLE",
        help="Human-friendly connection title exposed in SQL cell connector picker.",
    ),
    snowflake_account: str | None = typer.Option(
        None,
        "--snowflake-account",
        envvar="SNOWFLAKE_ACCOUNT",
        help="Snowflake account identifier (enables Snowflake bridge when used with --snowflake-user).",
    ),
    snowflake_user: str | None = typer.Option(
        None,
        "--snowflake-user",
        envvar="SNOWFLAKE_USER",
        help="Snowflake username.",
    ),
    snowflake_password: str | None = typer.Option(
        None,
        "--snowflake-password",
        envvar="SNOWFLAKE_PASSWORD",
        help="Snowflake password.",
    ),
    snowflake_warehouse: str | None = typer.Option(
        None,
        "--snowflake-warehouse",
        envvar="SNOWFLAKE_WAREHOUSE",
        help="Default Snowflake warehouse.",
    ),
    snowflake_database: str | None = typer.Option(
        None,
        "--snowflake-database",
        envvar="SNOWFLAKE_DATABASE",
        help="Default Snowflake database.",
    ),
    snowflake_schema: str | None = typer.Option(
        None,
        "--snowflake-schema",
        envvar="SNOWFLAKE_SCHEMA",
        help="Default Snowflake schema.",
    ),
    snowflake_role: str | None = typer.Option(
        None,
        "--snowflake-role",
        envvar="SNOWFLAKE_ROLE",
        help="Optional Snowflake role.",
    ),
    snowflake_authenticator: str | None = typer.Option(
        None,
        "--snowflake-authenticator",
        envvar="SNOWFLAKE_AUTHENTICATOR",
        help="Optional Snowflake authenticator (for example, externalbrowser).",
    ),
    snowflake_connection_id: str = typer.Option(
        "snowflake-default",
        "--snowflake-connection-id",
        envvar="SQLROOMS_SNOWFLAKE_CONNECTION_ID",
        help="Connection id exposed to DbSlice for the Snowflake bridge.",
    ),
    snowflake_title: str = typer.Option(
        "Snowflake",
        "--snowflake-title",
        envvar="SQLROOMS_SNOWFLAKE_TITLE",
        help="Human-friendly title exposed for the Snowflake connection.",
    ),
    no_open_browser: bool = typer.Option(
        False, "--no-open-browser", help="Skip automatically opening the browser."
    ),
    ui: str = typer.Option(
        None,
        "--ui",
        help="Optional path to a custom UI bundle directory (Vite dist). If omitted, uses the bundled default UI.",
    ),
    sync: bool = typer.Option(
        False,
        "--sync",
        help="Enable optional sync (CRDT) over WebSocket (Loro).",
    ),
    meta_db: str | None = typer.Option(
        None,
        "--meta-db",
        help="Optional path to a dedicated DuckDB file for SQLRooms meta state (UI state + CRDT snapshots). If omitted, stores meta tables in the main DB.",
    ),
    meta_namespace: str = typer.Option(
        "__sqlrooms",
        "--meta-namespace",
        help="Namespace used for SQLRooms meta tables. If --meta-db is provided, this is the ATTACH alias; otherwise it's a schema in the main DB.",
    ),
):
    """
    Start the SQLRooms local experience:
    - Boots a DuckDB websocket server (sqlrooms-server).
    - Serves the AI example UI with persisted state stored in DuckDB.
    """
    try:
        config_path = _resolve_config_path(config, no_config=no_config)
        connector_config = _load_connector_config(config_path)
    except Exception as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=1) from exc

    if ctx.get_parameter_source("postgres_dsn") == ParameterSource.DEFAULT:
        postgres_dsn = connector_config.get("postgres_dsn")
    if ctx.get_parameter_source("postgres_connection_id") == ParameterSource.DEFAULT:
        postgres_connection_id = connector_config.get(
            "postgres_connection_id", postgres_connection_id
        )
    if ctx.get_parameter_source("postgres_title") == ParameterSource.DEFAULT:
        postgres_title = connector_config.get("postgres_title", postgres_title)
    if ctx.get_parameter_source("snowflake_account") == ParameterSource.DEFAULT:
        snowflake_account = connector_config.get("snowflake_account")
    if ctx.get_parameter_source("snowflake_user") == ParameterSource.DEFAULT:
        snowflake_user = connector_config.get("snowflake_user")
    if ctx.get_parameter_source("snowflake_password") == ParameterSource.DEFAULT:
        snowflake_password = connector_config.get("snowflake_password")
    if ctx.get_parameter_source("snowflake_warehouse") == ParameterSource.DEFAULT:
        snowflake_warehouse = connector_config.get("snowflake_warehouse")
    if ctx.get_parameter_source("snowflake_database") == ParameterSource.DEFAULT:
        snowflake_database = connector_config.get("snowflake_database")
    if ctx.get_parameter_source("snowflake_schema") == ParameterSource.DEFAULT:
        snowflake_schema = connector_config.get("snowflake_schema")
    if ctx.get_parameter_source("snowflake_role") == ParameterSource.DEFAULT:
        snowflake_role = connector_config.get("snowflake_role")
    if ctx.get_parameter_source("snowflake_authenticator") == ParameterSource.DEFAULT:
        snowflake_authenticator = connector_config.get("snowflake_authenticator")
    if ctx.get_parameter_source("snowflake_connection_id") == ParameterSource.DEFAULT:
        snowflake_connection_id = connector_config.get(
            "snowflake_connection_id", snowflake_connection_id
        )
    if ctx.get_parameter_source("snowflake_title") == ParameterSource.DEFAULT:
        snowflake_title = connector_config.get("snowflake_title", snowflake_title)

    resolved_db_path = db_path if db_path is not None else db_path_option
    snowflake_settings = SnowflakeConnectorSettings(
        account=snowflake_account,
        user=snowflake_user,
        password=snowflake_password,
        warehouse=snowflake_warehouse,
        database=snowflake_database,
        schema=snowflake_schema,
        role=snowflake_role,
        authenticator=snowflake_authenticator,
        connection_id=snowflake_connection_id,
        title=snowflake_title,
    )
    server = SqlroomsHttpServer(
        db_path=resolved_db_path,
        host=host,
        port=port,
        ws_port=ws_port,
        sync_enabled=sync,
        meta_db=meta_db,
        meta_namespace=meta_namespace,
        llm_provider=llm_provider,
        llm_model=llm_model,
        api_key=api_key,
        postgres_dsn=postgres_dsn,
        postgres_connection_id=postgres_connection_id,
        postgres_title=postgres_title,
        snowflake_settings=snowflake_settings,
        open_browser=not no_open_browser,
        ui_dir=ui,
    )
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        sys.stderr.write("\nShutting down...\n")

