import pytest
from httpx import ASGITransport, AsyncClient
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

@pytest.mark.asyncio
async def test_api_config(server):
    app = server._build_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/config")
    
    assert response.status_code == 200
    data = response.json()
    assert "wsUrl" in data
    assert "dbPath" in data

@pytest.mark.asyncio
async def test_api_state(server):
    app = server._build_app()
    state = {"layout": {"test": True}}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Save state
        save_resp = await ac.post("/api/state", json=state)
        assert save_resp.status_code == 200
        
        # Load state
        load_resp = await ac.get("/api/state")
        assert load_resp.status_code == 200
        assert load_resp.json()["layout"] == state["layout"]
        
        # Clear state
        clear_resp = await ac.delete("/api/state")
        assert clear_resp.status_code == 200
        
        # Load state again
        load_resp_2 = await ac.get("/api/state")
        assert load_resp_2.json() == {}

@pytest.mark.asyncio
async def test_api_upload(server, tmp_path):
    app = server._build_app()
    file_content = b"test content"
    files = {"file": ("test.txt", file_content)}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/upload", files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert "path" in data
    assert Path(data["path"]).name == "test.txt"
    assert Path(data["path"]).read_bytes() == file_content

