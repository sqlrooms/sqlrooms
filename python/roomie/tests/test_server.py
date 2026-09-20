"""Exercise Roomie's composition through its production HTTP and WebSocket APIs."""

import json
from unittest.mock import AsyncMock

import duckdb
from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect

from roomie import __version__


def native_headers(server):
    return {"Authorization": "Bearer " + server.access.native_token}


def test_bootstrap_authentication_and_roomie_identity(server):
    with TestClient(server.app(), base_url=server._ui_url()) as client:
        for endpoint in ("/api/config", "/api/status", "/api/workspaces"):
            assert client.get(endpoint).status_code == 401
        assert (
            client.get("/api/config", headers=native_headers(server)).status_code == 403
        )
        assert (
            client.get(
                "/auth.json", headers={"Origin": "https://untrusted.invalid"}
            ).status_code
            == 403
        )
        assert (
            client.get("/auth.json", headers={"Host": "untrusted.invalid"}).status_code
            == 403
        )
        version = client.get("/version", headers=native_headers(server)).json()
        assert version["name"] == "roomie"
        assert version["version"] == __version__
        issued = client.post("/api/auth/ticket", headers=native_headers(server)).json()
        assert "#roomie-ticket=" in issued["url"]
        ticket = issued["url"].split("#roomie-ticket=")[1]
        exchanged = client.post("/api/auth/exchange", json={"ticket": ticket})
        assert exchanged.status_code == 200
        assert exchanged.headers["cache-control"] == "no-store"
        assert (
            client.post("/api/auth/exchange", json={"ticket": ticket}).status_code
            == 401
        )
        assert client.post("/api/auth/exchange", content=b"x" * 4097).status_code == 401
        token = exchanged.json()["token"]
        headers = {"Authorization": "Bearer " + token}
        config = client.get("/api/config", headers=headers).json()
        assert config["application"] == "roomie"
        assert config["wsUrl"] == "ws://127.0.0.1:43000/ws/duckdb"
        assert config["bridgeUrl"] == "ws://127.0.0.1:43000/ws/mcp-bridge"
        assert client.post("/api/auth/ticket", headers=headers).status_code == 403
        assert (
            client.post("/api/agent/session", headers=headers, json={}).status_code
            == 403
        )
        assert client.post("/mcp", headers=headers, json={}).status_code == 403
        renewed = client.post("/api/auth/renew", headers=headers).json()
        assert renewed["token"] == token
        identity = client.get("/api/agent/identity", headers=headers).json()
        assert identity["application"] == "roomie"
        assert identity["mcpEnabled"] is True
        assert (
            not {
                "profile",
                "executionMode",
                "embeddedAiEnabled",
                "credentialFile",
                "token",
            }
            & identity.keys()
        )


def test_shared_database_preserves_sqlrooms_state_and_has_no_sync(server):
    with duckdb.connect(server.duckdb_database) as db:
        db.execute("CREATE SCHEMA __sqlrooms")
        db.execute("CREATE TABLE __sqlrooms.ui_state (payload_json JSON)")
        db.execute('INSERT INTO __sqlrooms.ui_state VALUES (\'{"owner":"sqlrooms"}\')')
    app = server.app()
    with TestClient(app, base_url=server._ui_url()) as client:
        assert app.state.resources.sync is None
        assert app.state.resources.transport.crdt is None
        websocket_url = server._ui_url().replace("http:", "ws:") + "/ws/duckdb"
        with client.websocket_connect(websocket_url) as ws:
            ws.send_json({"type": "auth", "token": server.access.native_token})
            assert ws.receive_json() == {"type": "authAck"}
            ws.send_json(
                {
                    "type": "json",
                    "queryId": "save",
                    "sql": "INSERT INTO __roomie.ui_state(key, payload_json) VALUES ('default', '{\"owner\":\"roomie\"}') RETURNING key",
                }
            )
            assert json.loads(ws.receive_json()["data"]) == [{"key": "default"}]
            ws.send_json({"type": "crdt-join", "roomId": "disabled"})
            assert ws.receive_json()["type"] == "error"
        with client.websocket_connect(websocket_url) as ws:
            ws.send_json({"type": "auth", "token": "invalid"})
            with pytest.raises(WebSocketDisconnect):
                ws.receive_json()
    with duckdb.connect(server.duckdb_database, read_only=True) as db:
        assert json.loads(
            db.execute("SELECT payload_json FROM __sqlrooms.ui_state").fetchone()[0]
        ) == {"owner": "sqlrooms"}
        assert json.loads(
            db.execute("SELECT payload_json FROM __roomie.ui_state").fetchone()[0]
        ) == {"owner": "roomie"}
        assert (
            db.execute(
                "SELECT count(*) FROM information_schema.tables WHERE table_schema='__roomie' AND table_name='sync_rooms'"
            ).fetchone()[0]
            == 0
        )


def test_manual_close_is_rejected_and_failed_browser_flush_resumes(server, monkeypatch):
    browser = AsyncMock(side_effect=[{"ok": False}, {"ok": True}])
    monkeypatch.setattr(server.mcp_broker, "request", browser)
    with TestClient(server.app(), base_url=server._ui_url()) as client:
        closed = client.post("/api/agent/close", headers=native_headers(server))
        assert closed.json()["code"] == "manual_instance"
        browser.assert_not_awaited()
        server.agent_runtime.managed = True
        failed = client.post("/api/agent/close", headers=native_headers(server)).json()
        assert failed["code"] == "flush_failed"
        assert not server.agent_runtime.stopping
        assert server.runtime.ready
        assert not server._http_server.should_exit
        assert [call.args[0] for call in browser.await_args_list] == [
            "workspace.flush",
            "workspace.resume",
        ]


def test_managed_checkpoint_failure_is_retryable_without_repeating_browser_flush(
    server, monkeypatch
):
    server.agent_runtime.managed = True
    browser = AsyncMock(return_value={"ok": True})
    monkeypatch.setattr(server.mcp_broker, "request", browser)
    with TestClient(server.app(), base_url=server._ui_url()) as client:
        original_close = server.runtime.close
        calls = 0

        async def close():
            nonlocal calls
            calls += 1
            if calls == 1:
                raise OSError("checkpoint failed")
            await original_close()

        monkeypatch.setattr(server.runtime, "close", close)
        failed = client.post("/api/agent/close", headers=native_headers(server)).json()
        assert failed["code"] == "persistence_failed"
        assert server.agent_runtime.stopping and server.agent_runtime.close_failed
        assert not server._http_server.should_exit
        saved = client.post("/api/agent/close", headers=native_headers(server)).json()
        assert saved["ok"] is True and saved["application"] == "roomie"
        assert server.runtime.closed
        browser.assert_awaited_once_with("workspace.flush", timeout=15)
