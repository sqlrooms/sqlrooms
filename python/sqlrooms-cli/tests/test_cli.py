from pathlib import Path

from typer.testing import CliRunner
from sqlrooms.cli import (
    _default_config_candidates,
    _load_connector_config,
    _resolve_config_path,
    app,
)
from sqlrooms.web.db_bridge import PostgresConnectorSettings, SnowflakeConnectorSettings

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
[[connectors]]
id = "pg-local"
engine = "postgres"
dsn = "postgresql://u:p@localhost:5432/db"
title = "Local Postgres"

[[connectors]]
id = "sf-local"
engine = "snowflake"
account = "demo-account"
user = "demo-user"
warehouse = "DEMO_WH"
title = "Local Snowflake"
""".strip(),
        encoding="utf-8",
    )

    data = _load_connector_config(config_path)
    assert isinstance(data[0], PostgresConnectorSettings)
    assert data[0].dsn == "postgresql://u:p@localhost:5432/db"
    assert data[0].connection_id == "pg-local"
    assert data[0].title == "Local Postgres"
    assert isinstance(data[1], SnowflakeConnectorSettings)
    assert data[1].account == "demo-account"
    assert data[1].user == "demo-user"
    assert data[1].warehouse == "DEMO_WH"
    assert data[1].connection_id == "sf-local"
    assert data[1].title == "Local Snowflake"


def test_load_connector_config_rejects_duplicate_ids(tmp_path):
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[[connectors]]
id = "dup"
engine = "postgres"
dsn = "postgresql://u:p@localhost:5432/db"

[[connectors]]
id = "dup"
engine = "snowflake"
account = "demo-account"
user = "demo-user"
""".strip(),
        encoding="utf-8",
    )
    try:
        _load_connector_config(config_path)
    except RuntimeError as exc:
        assert "Duplicate connector id" in str(exc)
    else:
        raise AssertionError("Expected duplicate connector id failure")


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

