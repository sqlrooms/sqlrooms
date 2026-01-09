import pytest
from fastapi.testclient import TestClient
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
        open_browser=False
    )

def test_api_config(server):
    app = server._build_app()
    client = TestClient(app)
    response = client.get("/api/config")
    
    assert response.status_code == 200
    data = response.json()
    assert "wsUrl" in data
    assert "dbPath" in data

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

