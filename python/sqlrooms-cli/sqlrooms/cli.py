from __future__ import annotations

import asyncio
import logging
import json
from pathlib import Path
import sys

import duckdb
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
    Export app artifact files from a SQLRooms project file to a directory.
    """
    out = Path(out_dir).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(db_path)
    try:
        artifacts_ref = f'"{meta_namespace}"."artifacts"'
        files_ref = f'"{meta_namespace}"."artifact_files"'
        artifacts = con.execute(
            f"SELECT artifact_id, type, name, metadata_json FROM {artifacts_ref}"
        ).fetchall()
        for artifact_id, atype, name, metadata_json in artifacts:
            safe_name = "".join(ch for ch in str(name) if ch.isalnum() or ch in ("-", "_", " ")).strip()
            safe_name = safe_name.replace(" ", "-") or artifact_id
            root = out / f"{safe_name}-{artifact_id[:8]}"
            root.mkdir(parents=True, exist_ok=True)
            meta = {
                "artifactId": artifact_id,
                "type": atype,
                "name": name,
                "metadata": metadata_json,
            }
            (root / "artifact.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
            rows = con.execute(
                f"SELECT path, content FROM {files_ref} WHERE artifact_id = ?",
                [artifact_id],
            ).fetchall()
            for path, content in rows:
                rel = Path(str(path).lstrip("/"))
                target = root / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(str(content), encoding="utf-8")
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
    postgres_dsn: str = typer.Option(
        None,
        "--postgres-dsn",
        envvar="SQLROOMS_POSTGRES_DSN",
        help="Optional Postgres DSN to enable backend connector bridge testing in CLI mode.",
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
        open_browser=not no_open_browser,
        ui_dir=ui,
    )
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        sys.stderr.write("\nShutting down...\n")

