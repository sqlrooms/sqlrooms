from pathlib import Path

from typer.testing import CliRunner
from sqlrooms.cli import (
    DEFAULT_CONFIG_PATH,
    _load_ai_runtime_config,
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
[[db.connectors]]
id = "pg-local"
engine = "postgres"
host = "localhost"
port = "5432"
database = "db"
user = "u"
password = "p"
title = "Local Postgres"

[[db.connectors]]
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
    assert data[0].host == "localhost"
    assert data[0].port == "5432"
    assert data[0].database == "db"
    assert data[0].user == "u"
    assert data[0].password == "p"
    assert data[0].connection_id == "pg-local"
    assert data[0].title == "Local Postgres"
    assert isinstance(data[1], SnowflakeConnectorSettings)
    assert data[1].account == "demo-account"
    assert data[1].user == "demo-user"
    assert data[1].warehouse == "DEMO_WH"
    assert data[1].connection_id == "sf-local"
    assert data[1].title == "Local Snowflake"


def test_load_ai_runtime_config_toml(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "env-openai-key")
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[ai]
default_provider = "openai"
default_model = "gpt-5"

[[ai.providers]]
id = "openai"
base_url = "https://api.openai.com/v1"
api_key_env = "OPENAI_API_KEY"
models = ["gpt-5", "gpt-4.1"]

[[ai.providers]]
id = "anthropic"
base_url = "https://api.anthropic.com"
api_key = "anthropic-key"
models = ["claude-4-sonnet"]
""".strip(),
        encoding="utf-8",
    )

    default_provider, default_model, providers = _load_ai_runtime_config(config_path)
    assert default_provider == "openai"
    assert default_model == "gpt-5"
    assert providers["openai"]["apiKey"] == "env-openai-key"
    assert providers["openai"]["models"][0]["modelName"] == "gpt-5"
    assert providers["anthropic"]["apiKey"] == "anthropic-key"


def test_load_connector_config_rejects_duplicate_ids(tmp_path):
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[[db.connectors]]
id = "dup"
engine = "postgres"
host = "localhost"
database = "db"
user = "u"

[[db.connectors]]
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


def test_load_ai_runtime_config_rejects_unknown_default_provider(tmp_path):
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[ai]
default_provider = "missing"

[[ai.providers]]
id = "openai"
base_url = "https://api.openai.com/v1"
models = ["gpt-5"]
""".strip(),
        encoding="utf-8",
    )
    try:
        _load_ai_runtime_config(config_path)
    except RuntimeError as exc:
        assert "default_provider" in str(exc)
    else:
        raise AssertionError("Expected invalid default provider failure")


def test_resolve_config_path_prefers_explicit(tmp_path):
    explicit = tmp_path / "explicit.toml"
    explicit.write_text("[db.connectors]\n", encoding="utf-8")
    resolved = _resolve_config_path(str(explicit), no_config=False)
    assert resolved == explicit


def test_resolve_config_path_honors_no_config():
    assert _resolve_config_path(None, no_config=True) is None


def test_default_config_path():
    import sys

    if sys.platform.startswith("win"):
        import os

        expected = Path(os.environ.get("APPDATA", "")) / "sqlrooms" / "config.toml"
    else:
        expected = Path.home() / ".config" / "sqlrooms" / "config.toml"
    assert DEFAULT_CONFIG_PATH == expected


# Since the main function in cli.py starts an asyncio loop and a server,
# unit testing it without mocks is hard. We'll skip deep integration tests
# of the full server startup here.
