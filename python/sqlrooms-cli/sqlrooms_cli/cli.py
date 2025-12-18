from __future__ import annotations

import asyncio
import logging
import sys

import typer

from .server import SqlroomsHttpServer

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
    db_path: str = typer.Option(
        ":memory:",
        "--db-path",
        "-d",
        help="DuckDB database to use. Pass a filepath to persist, or ':memory:' for an in-memory DB (no file).",
        show_default=True,
    ),
    host: str = typer.Option("127.0.0.1", "--host", help="HTTP host for the UI."),
    port: int = typer.Option(4173, "--port", help="HTTP port for the UI."),
    ws_port: int = typer.Option(
        4000, "--ws-port", help="WebSocket port for DuckDB queries."
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
):
    """
    Start the SQLRooms local experience:
    - Boots a DuckDB websocket server (sqlrooms-server).
    - Serves the AI example UI with persisted state stored in DuckDB.
    """
    server = SqlroomsHttpServer(
        db_path=db_path,
        host=host,
        port=port,
        ws_port=ws_port,
        llm_provider=llm_provider,
        llm_model=llm_model,
        api_key=api_key,
        open_browser=not no_open_browser,
    )
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        sys.stderr.write("\nShutting down...\n")

