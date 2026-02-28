import pytest
from fastapi.testclient import TestClient
from sqlrooms.web.db_bridge import PostgresConnectorSettings, SnowflakeConnectorSettings
from sqlrooms.web.launcher import SqlroomsHttpServer
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
    assert data["dbBridge"]["id"] == "sqlrooms-cli-http-bridge"
    assert data["dbBridge"]["connections"] == []
    assert data["postgresBridgeEnabled"] is False


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
        connector_settings=[PostgresConnectorSettings(dsn="postgresql://example")],
    )
    app = server._build_app()
    client = TestClient(app)
    response = client.get("/api/config")

    assert response.status_code == 200
    data = response.json()
    assert data["postgresBridgeEnabled"] is True
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
        }
    ]


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
        }
    ]


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
                dsn="postgresql://a",
                connection_id="pg-a",
                title="Postgres A",
            ),
            PostgresConnectorSettings(
                dsn="postgresql://b",
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

