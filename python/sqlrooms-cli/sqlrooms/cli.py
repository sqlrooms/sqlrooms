from __future__ import annotations

import asyncio
import logging
import sys

import typer

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
    sync_db: str | None = typer.Option(
        None,
        "--sync-db",
        help="Optional path to a dedicated DuckDB file for sync snapshots (requires --sync). If omitted, uses a schema within the main DB.",
    ),
    sync_schema: str = typer.Option(
        "__sqlrooms",
        "--sync-schema",
        help="Namespace/schema to store sync snapshots (default: __sqlrooms). Used as ATTACH alias when --sync-db is provided.",
    ),
):
    """
    Start the SQLRooms local experience:
    - Boots a DuckDB websocket server (sqlrooms-server).
    - Serves the AI example UI with persisted state stored in DuckDB.
    """
    resolved_db_path = db_path if db_path is not None else db_path_option
    server = SqlroomsHttpServer(
        db_path=resolved_db_path,
        host=host,
        port=port,
        ws_port=ws_port,
        sync_enabled=sync,
        sync_db=sync_db,
        sync_schema=sync_schema,
        llm_provider=llm_provider,
        llm_model=llm_model,
        api_key=api_key,
        open_browser=not no_open_browser,
        ui_dir=ui,
    )
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        sys.stderr.write("\nShutting down...\n")

