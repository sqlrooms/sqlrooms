import pytest
from fastapi.testclient import TestClient
from fastapi import UploadFile
from starlette.requests import Request
from sqlrooms.web.db_bridge import PostgresConnectorSettings, SnowflakeConnectorSettings
from sqlrooms.web.launcher import SqlroomsHttpServer
from sqlrooms.web.launcher import _write_ai_settings_to_toml
from sqlrooms.web.launcher import _write_db_connectors_to_toml
from sqlrooms.web.launcher import _write_upload_to_path
from pathlib import Path


@pytest.fixture
def server(tmp_path):
    db_path = tmp_path / "test.db"
    return SqlroomsHttpServer(
        db_path=db_path,
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
    )


def test_api_config(server):
    app = server._build_app()
    client = TestClient(app)
    response = client.get("/api/config")

    assert response.status_code == 200
    data = response.json()
    assert "wsUrl" in data
    assert "dbPath" in data
    assert "dbBridge" in data
    assert "aiProviders" in data
    assert "loginTargets" in data
    assert len(data["loginTargets"]) == 2
    assert data["loginTargets"][0]["providerId"] == "anthropic"
    assert data["loginTargets"][1]["providerId"] == "openai"
    assert data["dbBridge"]["id"] == "sqlrooms-cli-http-bridge"
    assert data["dbBridge"]["connections"] == []
    assert data["dbBridge"]["diagnostics"] == []
    assert "wsAuthToken" in data


def test_api_config_with_ai_provider_metadata(tmp_path):
    db_path = tmp_path / "test.db"
    server = SqlroomsHttpServer(
        db_path=db_path,
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
        llm_provider="openai",
        llm_model="gpt-5",
        ai_providers={
            "openai": {
                "baseUrl": "https://api.openai.com/v1",
                "apiKey": "demo-key",
                "models": [{"modelName": "gpt-5"}],
            }
        },
    )
    app = server._build_app()
    client = TestClient(app)
    response = client.get("/api/config")

    assert response.status_code == 200
    data = response.json()
    assert data["llmProvider"] == "openai"
    assert data["llmModel"] == "gpt-5"
    assert "openai" in data["aiProviders"]
    assert data["loginTargets"] == []


def test_ai_settings_routes_and_manual_auth(tmp_path):
    db_path = tmp_path / "test.db"
    config_path = tmp_path / "config.toml"
    auth_path = tmp_path / "auth.toml"
    config_path.write_text(
        """
[ai]
default_provider = "openai"
default_model = "gpt-5"

[[ai.providers]]
id = "openai"
title = "OpenAI"
kind = "builtin"
base_url = "https://api.openai.com/v1"
default_auth_method = "manual_api_key"
models = ["gpt-5"]

[[ai.providers.auth_methods]]
id = "manual_api_key"
type = "api_key"
label = "Manually enter API Key"
""".strip(),
        encoding="utf-8",
    )
    server = SqlroomsHttpServer(
        db_path=db_path,
        host="127.0.0.1",
        port=4173,
        ws_port=None,
        open_browser=False,
        config_path=config_path,
        auth_path=auth_path,
    )
    client = TestClient(server._build_app())

    settings_response = client.get("/api/ai/settings")
    assert settings_response.status_code == 200
    settings = settings_response.json()
    assert settings["config"]["defaultProvider"] == "openai"
    assert (
        settings["config"]["providers"]["openai"]["status"]["hasCredentials"] is False
    )

    start_response = client.post(
        "/api/ai/auth/start",
        json={"providerId": "openai", "authMethodId": "manual_api_key"},
    )
    assert start_response.status_code == 200
    assert start_response.json()["flowType"] == "api_key"

    complete_response = client.post(
        "/api/ai/auth/complete",
        json={
            "providerId": "openai",
            "authMethodId": "manual_api_key",
            "apiKey": "test-openai-key",
        },
    )
    assert complete_response.status_code == 200
    assert auth_path.exists()
    assert "test-openai-key" in auth_path.read_text(encoding="utf-8")

    status_response = client.get("/api/ai/auth/status", params={"providerId": "openai"})
    assert status_response.status_code == 200
    assert status_response.json()["provider"]["status"]["hasCredentials"] is True

    test_response = client.post("/api/ai/auth/test", json={"providerId": "openai"})
    assert test_response.status_code == 200
    assert test_response.json()["ok"] is True

    logout_response = client.post("/api/ai/auth/logout", json={"providerId": "openai"})
    assert logout_response.status_code == 200

    status_after_logout = client.get(
        "/api/ai/auth/status",
        params={"providerId": "openai"},
    )
    assert status_after_logout.status_code == 200
    assert status_after_logout.json()["provider"]["status"]["hasCredentials"] is False


def test_api_upload(server, tmp_path):
    app = server._build_app()
    file_content = b"test content"
    files = {"file": ("test.txt", file_content)}

    client = TestClient(app)
    response = client.post("/api/upload", files=files)

    assert response.status_code == 200
    data = response.json()
    assert "path" in data
    assert Path(data["path"]).name == "test.txt"
    assert Path(data["path"]).read_bytes() == file_content


def test_api_upload_allows_files_larger_than_previous_cap(server, tmp_path):
    app = server._build_app()
    source = tmp_path / "large.bin"
    source_size = 50 * 1024 * 1024 + 1
    with open(source, "wb") as f:
        f.truncate(source_size)

    client = TestClient(app)
    with open(source, "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("large.bin", f, "application/octet-stream")},
        )

    assert response.status_code == 200
    data = response.json()
    uploaded = Path(data["path"])
    assert uploaded.name == "large.bin"
    assert uploaded.stat().st_size == source_size


@pytest.mark.asyncio
async def test_write_upload_to_path_streams_files_larger_than_previous_cap(tmp_path):
    source = tmp_path / "large.bin"
    source_size = 50 * 1024 * 1024 + 1
    with open(source, "wb") as f:
        f.truncate(source_size)

    target = tmp_path / "uploaded.bin"
    with open(source, "rb") as f:
        bytes_written = await _write_upload_to_path(
            UploadFile(file=f, filename="large.bin"),
            target,
        )

    assert bytes_written == source_size
    assert target.stat().st_size == source_size


def test_no_ui_keeps_api_but_does_not_mount_static_ui(tmp_path):
    db_path = tmp_path / "test.db"
    ui_dir = tmp_path / "ui"
    ui_dir.mkdir()
    (ui_dir / "index.html").write_text("<h1>SQLRooms UI</h1>", encoding="utf-8")
    server = SqlroomsHttpServer(
        db_path=db_path,
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
        ui_dir=str(ui_dir),
        serve_ui=False,
    )
    app = server._build_app()
    client = TestClient(app)

    assert client.get("/api/config").status_code == 200
    assert client.get("/").status_code == 404


def test_api_config_with_postgres_connector(tmp_path):
    db_path = tmp_path / "test.db"
    server = SqlroomsHttpServer(
        db_path=db_path,
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
        connector_settings=[
            PostgresConnectorSettings(host="localhost", database="example", user="u")
        ],
    )
    app = server._build_app()
    client = TestClient(app)
    response = client.get("/api/config")

    assert response.status_code == 200
    data = response.json()
    assert data["dbBridge"]["id"] == "sqlrooms-cli-http-bridge"
    assert data["dbBridge"]["connections"] == [
        {
            "id": "postgres-default",
            "engineId": "postgres",
            "title": "Postgres",
            "runtimeSupport": "server",
            "requiresBridge": True,
            "bridgeId": "sqlrooms-cli-http-bridge",
            "isCore": False,
            "config": {
                "host": "localhost",
                "port": "5432",
                "database": "example",
                "user": "u",
            },
        }
    ]
    assert len(data["dbBridge"]["diagnostics"]) == 1
    assert data["dbBridge"]["diagnostics"][0]["id"] == "postgres-default"
    assert data["dbBridge"]["diagnostics"][0]["engineId"] == "postgres"
    assert "available" in data["dbBridge"]["diagnostics"][0]


def test_api_config_with_snowflake_connector_metadata(tmp_path):
    db_path = tmp_path / "test.db"
    server = SqlroomsHttpServer(
        db_path=db_path,
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
        connector_settings=[
            SnowflakeConnectorSettings(
                account="demo-account",
                user="demo-user",
            )
        ],
    )
    app = server._build_app()
    client = TestClient(app)
    response = client.get("/api/config")

    assert response.status_code == 200
    data = response.json()
    assert data["dbBridge"]["connections"] == [
        {
            "id": "snowflake-default",
            "engineId": "snowflake",
            "title": "Snowflake",
            "runtimeSupport": "server",
            "requiresBridge": True,
            "bridgeId": "sqlrooms-cli-http-bridge",
            "isCore": False,
            "config": {
                "account": "demo-account",
                "user": "demo-user",
            },
        }
    ]
    assert len(data["dbBridge"]["diagnostics"]) == 1
    assert data["dbBridge"]["diagnostics"][0]["id"] == "snowflake-default"
    assert data["dbBridge"]["diagnostics"][0]["engineId"] == "snowflake"
    assert "available" in data["dbBridge"]["diagnostics"][0]


def test_api_config_with_multiple_same_engine_connectors(tmp_path):
    db_path = tmp_path / "test.db"
    server = SqlroomsHttpServer(
        db_path=db_path,
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
        connector_settings=[
            PostgresConnectorSettings(
                host="localhost",
                database="a",
                user="u",
                connection_id="pg-a",
                title="Postgres A",
            ),
            PostgresConnectorSettings(
                host="localhost",
                database="b",
                user="u",
                connection_id="pg-b",
                title="Postgres B",
            ),
        ],
    )
    app = server._build_app()
    client = TestClient(app)
    response = client.get("/api/config")

    assert response.status_code == 200
    data = response.json()
    assert [c["id"] for c in data["dbBridge"]["connections"]] == ["pg-a", "pg-b"]


def test_api_test_connection_adhoc_unsupported_engine(server):
    app = server._build_app()
    client = TestClient(app)
    response = client.post(
        "/api/db/test-connection",
        json={"engine": "mysql", "config": {"host": "localhost"}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is False
    assert "Unsupported engine" in data["error"]


def test_api_test_connection_adhoc_missing_driver(server):
    app = server._build_app()
    client = TestClient(app)
    response = client.post(
        "/api/db/test-connection",
        json={
            "engine": "postgres",
            "config": {"host": "localhost", "database": "x", "user": "x"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is False
    assert "error" in data


def test_api_test_connection_missing_params(server):
    app = server._build_app()
    client = TestClient(app)
    response = client.post("/api/db/test-connection", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is False
    assert "error" in data


def test_api_config_redacts_secret_fields(tmp_path):
    db_path = tmp_path / "test.db"
    server = SqlroomsHttpServer(
        db_path=db_path,
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
        connector_settings=[
            PostgresConnectorSettings(
                host="localhost",
                database="db",
                user="u",
                password="top-secret",
                connection_id="pg-secret",
            ),
        ],
    )
    app = server._build_app()
    client = TestClient(app)
    response = client.get("/api/config")

    assert response.status_code == 200
    conn = response.json()["dbBridge"]["connections"][0]
    assert "password" not in conn.get("config", {})


def test_write_toml_engine_change_clears_stale_keys(tmp_path):
    """Switching a connection from snowflake to postgres drops snowflake-only keys."""
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[[db.connectors]]
id = "c1"
engine = "snowflake"
title = "My Conn"
account = "xy12345"
user = "sf_user"
warehouse = "WH"
schema = "PUBLIC"
""".strip(),
        encoding="utf-8",
    )

    _write_db_connectors_to_toml(
        config_path,
        [
            {
                "id": "c1",
                "engineId": "postgres",
                "title": "My Conn",
                "config": {
                    "host": "localhost",
                    "port": "5432",
                    "database": "mydb",
                    "user": "pg_user",
                },
            }
        ],
    )

    import tomllib

    with config_path.open("rb") as fh:
        doc = tomllib.load(fh)
    entry = doc["db"]["connectors"][0]
    assert entry["engine"] == "postgres"
    assert entry["host"] == "localhost"
    assert entry["user"] == "pg_user"
    assert "account" not in entry
    assert "warehouse" not in entry
    assert "schema" not in entry


def test_write_ai_settings_to_toml_preserves_api_key_env(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "env-secret")
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        """
[other]
value = "preserved"

[ai]
default_provider = "openai"
default_model = "gpt-4.1"

[[ai.providers]]
id = "openai"
base_url = "https://api.openai.com/v1"
api_key_env = "OPENAI_API_KEY"
models = ["gpt-4.1"]
""".strip(),
        encoding="utf-8",
    )

    _write_ai_settings_to_toml(
        config_path,
        {
            "defaultProvider": "openai",
            "defaultModel": "gpt-5",
            "settings": {
                "providers": {
                    "openai": {
                        "baseUrl": "https://api.openai.com/v1",
                        "apiKey": "env-secret",
                        "models": [{"modelName": "gpt-5"}],
                    }
                },
                "customModels": [
                    {
                        "modelName": "local-qwen",
                        "baseUrl": "http://localhost:11434/v1",
                        "apiKey": "local-key",
                    }
                ],
                "modelParameters": {
                    "maxSteps": 12,
                    "additionalInstruction": "Be concise.",
                },
            },
        },
    )

    import tomllib

    with config_path.open("rb") as fh:
        doc = tomllib.load(fh)
    assert doc["other"]["value"] == "preserved"
    assert doc["ai"]["default_model"] == "gpt-5"
    provider = doc["ai"]["providers"][0]
    assert provider["api_key_env"] == "OPENAI_API_KEY"
    assert "api_key" not in provider
    assert provider["models"] == ["gpt-5"]
    assert doc["ai"]["custom_models"][0]["model_name"] == "local-qwen"
    assert doc["ai"]["model_parameters"]["max_steps"] == 12


def test_api_put_ai_settings_writes_config(tmp_path):
    config_path = tmp_path / "config.toml"
    server = SqlroomsHttpServer(
        db_path=tmp_path / "test.db",
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
        config_path=config_path,
    )
    app = server._build_app()
    client = TestClient(app)

    response = client.put(
        "/api/ai/settings",
        json={
            "defaultProvider": "anthropic",
            "defaultModel": "claude-4-sonnet",
            "settings": {
                "providers": {
                    "anthropic": {
                        "baseUrl": "https://api.anthropic.com",
                        "apiKey": "anthropic-key",
                        "models": [{"modelName": "claude-4-sonnet"}],
                    }
                },
                "customModels": [],
                "modelParameters": {
                    "maxSteps": 8,
                    "additionalInstruction": "",
                },
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True

    import tomllib

    with config_path.open("rb") as fh:
        doc = tomllib.load(fh)
    assert doc["ai"]["default_provider"] == "anthropic"
    assert doc["ai"]["default_model"] == "claude-4-sonnet"
    assert doc["ai"]["providers"][0]["api_key"] == "anthropic-key"
    assert doc["ai"]["model_parameters"]["max_steps"] == 8
    assert doc["ai"]["model_parameters"]["additional_instruction"] == ""
    assert server.llm_provider == "anthropic"
    assert server.llm_model == "claude-4-sonnet"
    assert server.ai_model_parameters["maxSteps"] == 8
    assert server.ai_model_parameters["additionalInstruction"] == ""


def test_api_put_ai_settings_rejects_fractional_max_steps(tmp_path):
    config_path = tmp_path / "config.toml"
    server = SqlroomsHttpServer(
        db_path=tmp_path / "test.db",
        host="127.0.0.1",
        port=0,
        ws_port=None,
        open_browser=False,
        config_path=config_path,
    )
    app = server._build_app()
    client = TestClient(app)

    response = client.put(
        "/api/ai/settings",
        json={
            "defaultProvider": "anthropic",
            "defaultModel": "claude-4-sonnet",
            "settings": {
                "providers": {},
                "modelParameters": {
                    "maxSteps": 8.5,
                },
            },
        },
    )

    assert response.status_code == 400
    assert "maxSteps" in response.json()["error"]
    assert not config_path.exists()
    assert server.llm_provider is None


def test_api_auth_allows_loopback_without_token(server):
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/db/settings",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("127.0.0.1", 4173),
            "scheme": "http",
        }
    )
    assert server._is_authorized_request(request) is True


def test_api_auth_requires_token_for_non_loopback(server):
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/db/settings",
            "headers": [],
            "client": ("10.0.0.2", 12345),
            "server": ("127.0.0.1", 4173),
            "scheme": "http",
        }
    )
    assert server._is_authorized_request(request) is False
