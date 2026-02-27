from __future__ import annotations

import asyncio
import logging
import sys

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

