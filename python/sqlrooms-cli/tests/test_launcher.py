import pytest
from fastapi.testclient import TestClient
from sqlrooms.web.db_bridge import PostgresConnectorSettings, SnowflakeConnectorSettings
from sqlrooms.web.launcher import SqlroomsHttpServer
from sqlrooms.web.launcher import _write_db_connectors_to_toml
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
    assert data["dbBridge"]["id"] == "sqlrooms-cli-http-bridge"
    assert data["dbBridge"]["connections"] == []
    assert data["dbBridge"]["diagnostics"] == []


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
