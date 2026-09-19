"""Exercise lifecycle controls through the same production auth middleware."""

import asyncio
from types import SimpleNamespace
import uuid

from fastapi.testclient import TestClient
import pytest

from sqlrooms.agent.contract import CONTRACT
from sqlrooms.web.launcher import SqlroomsHttpServer
import mcp.types as types


@pytest.fixture
def server(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLROOMS_HOME", str(tmp_path / "private"))
    runtime = SqlroomsHttpServer(
        str(tmp_path / "workspace.duckdb"),
        "127.0.0.1",
        43000,
        43001,
        mcp_port=43002,
        open_browser=False,
    )
    runtime.agent_runtime.workspace = runtime.agent_runtime.catalog.register(
        runtime.duckdb_database
    )
    runtime._http_server = SimpleNamespace(should_exit=False)
    return runtime


def headers(server):
    return {"Authorization": "Bearer " + server.access.native_token}


def test_control_requires_auth_and_close_preserves_manual_ownership(server):
    with TestClient(server._build_app(), base_url="http://127.0.0.1:43000") as client:
        for endpoint in ("session", "cancel", "close", "browser"):
            assert client.post("/api/agent/" + endpoint, json={}).status_code == 401
        assert (
            client.post("/api/agent/close", json={}, headers=headers(server)).json()[
                "code"
            ]
            == "manual_instance"
        )
        page = server.access.redeem(server.access.ticket())["token"]
        assert (
            client.post(
                "/api/agent/session",
                json={},
                headers={"Authorization": "Bearer " + page},
            ).status_code
            == 403
        )
        identity = client.get("/api/agent/identity", headers=headers(server)).json()
        assert "token" not in str(identity) and "credentialFile" not in identity


def test_close_failed_flush_does_not_stop_server(server, monkeypatch):
    calls = []

    async def request(method, **kwargs):
        calls.append(method)
        if method == "workspace.flush":
            return {"ok": False}
        return {"ok": True}

    monkeypatch.setattr(server.mcp_broker, "request", request)
    server.agent_runtime.managed = True
    with TestClient(server._build_app(), base_url="http://127.0.0.1:43000") as client:
        value = client.post("/api/agent/close", json={}, headers=headers(server)).json()
        assert value["code"] == "flush_failed"
        assert not server._http_server.should_exit and not server.agent_runtime.stopping
        assert calls == ["workspace.flush", "workspace.resume"]


def test_rename_updates_runtime_and_catalog(server):
    with TestClient(server._build_app(), base_url="http://127.0.0.1:43000") as client:
        result = client.post(
            "/api/workspaces/rename",
            headers=headers(server),
            json={
                "workspaceId": server.agent_runtime.workspace["workspaceId"],
                "name": "Renamed",
            },
        )
        assert result.status_code == 200
        assert (
            client.get("/api/agent/identity", headers=headers(server)).json()["name"]
            == "Renamed"
        )


@pytest.mark.asyncio
async def test_closing_rejects_legacy_mcp_calls_without_operation_metadata(server):
    server.agent_runtime.stopping = True
    result = await server.mcp_service._call_tool(
        SimpleNamespace(request_id=1, session=None),
        types.CallToolRequestParams(
            name="execute_command", arguments={"commandId": "change"}
        ),
    )
    assert result.structured_content["code"] == "workspace_busy"


@pytest.mark.asyncio
async def test_forwarded_operations_survive_response_loss_and_cancel_by_caller(
    server, monkeypatch
):
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def request(method, params=None):
        if method == "tools.list":
            return CONTRACT["tools"]
        started.set()
        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    monkeypatch.setattr(server.mcp_broker, "request", request)
    caller = server.access.verify(server.access.native_token, "mcp")
    context = SimpleNamespace(
        request=SimpleNamespace(state=SimpleNamespace(sqlrooms_caller=caller)),
        request_id=1,
        session=None,
    )
    operation = str(uuid.uuid4())
    params = types.CallToolRequestParams(
        name="query",
        arguments={"sql": "select 1"},
        meta={"sqlrooms/operationId": operation},
    )
    response = asyncio.create_task(server.mcp_service._call_tool(context, params))
    await asyncio.wait_for(started.wait(), 2)
    response.cancel()
    with pytest.raises(asyncio.CancelledError):
        await response
    assert not cancelled.is_set()
    other = server.access.verify(
        server.access.issue("connector", frozenset({"control"})), "control"
    )
    server.agent_runtime.operations.cancel(other, operation)
    assert not cancelled.is_set()
    server.agent_runtime.operations.cancel(caller, operation)
    await asyncio.wait_for(cancelled.wait(), 2)


@pytest.mark.asyncio
@pytest.mark.parametrize("forwarded", [False, True])
async def test_close_cannot_overtake_admitted_mcp_call(server, monkeypatch, forwarded):
    import httpx

    server.agent_runtime.managed = True
    started = asyncio.Event()
    release = asyncio.Event()
    methods = []

    async def request(method, params=None, **kwargs):
        methods.append(method)
        started.set()
        await release.wait()
        return CONTRACT["tools"] if method == "tools.list" else {"ok": True}

    monkeypatch.setattr(server.mcp_broker, "request", request)
    caller = server.access.verify(server.access.native_token, "mcp")
    context = SimpleNamespace(
        request=SimpleNamespace(state=SimpleNamespace(sqlrooms_caller=caller)),
        request_id=1,
        session=None,
    )
    params = types.CallToolRequestParams(
        name="execute_command",
        arguments={},
        meta={"sqlrooms/operationId": str(uuid.uuid4())} if forwarded else None,
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=server._build_app()),
        base_url="http://127.0.0.1:43000",
    ) as client:
        call = asyncio.create_task(server.mcp_service._call_tool(context, params))
        # Dispatch admission occurs before its deferred broker task runs.
        await asyncio.sleep(0)
        closed = await client.post("/api/agent/close", headers=headers(server), json={})
        assert closed.json()["code"] == "workspace_busy"
        assert "workspace.flush" not in methods
        await started.wait()
        release.set()
        await call
        assert server.agent_runtime.active_calls == 0


def test_browser_open_rejects_stopping_runtime(server):
    server.agent_runtime.stopping = True
    with TestClient(server._build_app(), base_url="http://127.0.0.1:43000") as client:
        response = client.post("/api/agent/browser", headers=headers(server), json={})
        assert response.json()["code"] == "workspace_busy"
