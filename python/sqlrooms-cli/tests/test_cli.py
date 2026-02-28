from pathlib import Path

from typer.testing import CliRunner
from sqlrooms.cli import (
    _default_config_candidates,
    _load_connector_config,
    _resolve_config_path,
    app,
)

runner = CliRunner()

def test_cli_help():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "Start the SQLRooms local experience" in result.stdout

def test_cli_export_help():
    result = runner.invoke(app, ["export", "--help"])
    assert result.exit_code == 0
    assert "Usage" in result.stdout
    assert "export" in result.stdout


def test_load_connector_config_toml(tmp_path):
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[connectors.postgres]
dsn = "postgresql://u:p@localhost:5432/db"
connection_id = "pg-local"
title = "Local Postgres"

[connectors.snowflake]
account = "demo-account"
user = "demo-user"
warehouse = "DEMO_WH"
connection_id = "sf-local"
title = "Local Snowflake"
""".strip(),
        encoding="utf-8",
    )

    data = _load_connector_config(config_path)
    assert data["postgres_dsn"] == "postgresql://u:p@localhost:5432/db"
    assert data["postgres_connection_id"] == "pg-local"
    assert data["postgres_title"] == "Local Postgres"
    assert data["snowflake_account"] == "demo-account"
    assert data["snowflake_user"] == "demo-user"
    assert data["snowflake_warehouse"] == "DEMO_WH"
    assert data["snowflake_connection_id"] == "sf-local"
    assert data["snowflake_title"] == "Local Snowflake"


def test_resolve_config_path_prefers_explicit(tmp_path):
    explicit = tmp_path / "explicit.toml"
    explicit.write_text("[connectors]\n", encoding="utf-8")
    resolved = _resolve_config_path(str(explicit), no_config=False)
    assert resolved == explicit


def test_resolve_config_path_honors_no_config():
    assert _resolve_config_path(None, no_config=True) is None


def test_default_config_candidates_include_legacy_path():
    candidates = _default_config_candidates()
    assert Path.home() / ".sqlrooms" / "config.toml" in candidates


# Since the main function in cli.py starts an asyncio loop and a server,
# unit testing it without mocks is hard. We'll skip deep integration tests
# of the full server startup here.

