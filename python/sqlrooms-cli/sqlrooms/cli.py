from __future__ import annotations

import asyncio
import hashlib
import logging
import json
import re
from pathlib import Path
import sys

import duckdb
import typer

from .web.db_bridge import SnowflakeConnectorSettings
from .web.launcher import SqlroomsHttpServer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = typer.Typer(
    add_completion=False,
    pretty_exceptions_enable=False,
    invoke_without_command=True,
)


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

