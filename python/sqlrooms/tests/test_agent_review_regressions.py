"""Regression coverage for agent discovery, errors, and interrupted startup."""

import asyncio
import json
import os
import subprocess
import sys
from unittest.mock import AsyncMock, Mock
import uuid

from fastapi.testclient import TestClient
import pytest

from sqlrooms.agent import code_plugin, process, registry
from sqlrooms.agent.catalog import Catalog
from sqlrooms.agent.manager import Manager
from sqlrooms.agent.operations import Operations
from sqlrooms.agent.storage import WorkspaceError, home
from sqlrooms.server.access import AccessDenied, LocalAccess
from sqlrooms.web.launcher import SqlroomsHttpServer


@pytest.fixture(autouse=True)
def private_home(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLROOMS_HOME", str(tmp_path / "private"))
    monkeypatch.delenv("SQLROOMS_MANAGED", raising=False)
    monkeypatch.delenv("SQLROOMS_WORKSPACES_DIR", raising=False)


@pytest.mark.parametrize("marker", [None, "original", "reused"])
@pytest.mark.parametrize("saved_marker", [None, "original"])
@pytest.mark.parametrize("pid_state", ["live", "dead", "denied"])
def test_registration_retains_uncertain_identity(
    monkeypatch, marker, saved_marker, pid_state
):
    record = {"instanceId": "instance", "pid": 123, "processMarker": saved_marker}
    registry.publish(record)
    monkeypatch.setattr(registry, "process_marker", lambda _: marker)

    def check_pid(pid, signal):
        assert (pid, signal) == (123, 0)
        if pid_state == "dead":
            raise ProcessLookupError()
        if pid_state == "denied":
            raise PermissionError()

    monkeypatch.setattr(registry.os, "kill", check_pid)
    retained = (
        pid_state != "dead"
        if marker is None or saved_marker is None
        else marker == saved_marker
    )
    assert registry.records() == ([record] if retained else [])
    assert (home() / "runtime/instance.json").exists() == retained


@pytest.mark.parametrize("open_browser", [True, False])
@pytest.mark.parametrize("stopping", [True, False])
def test_browser_lifecycle_errors_reach_manager(
    tmp_path, monkeypatch, open_browser, stopping
):
    server = SqlroomsHttpServer(
        str(tmp_path / "workspace.duckdb"),
        "127.0.0.1",
        43000,
        43001,
        mcp_port=43002,
        open_browser=False,
        serve_ui=False,
    )
    server.agent_runtime.stopping = stopping
    monkeypatch.setattr(
        registry,
        "credential",
        lambda _: {
            "apiUrl": "http://127.0.0.1:43000",
            "token": server.access.native_token,
        },
    )
    monkeypatch.setattr(
        registry.httpx,
        "Client",
        lambda **_: TestClient(
            server._build_app(),
            base_url="http://127.0.0.1:43000",
        ),
    )
    with pytest.raises(WorkspaceError) as error:
        Manager()._ready({}, open_browser)
    assert error.value.result["code"] == (
        "workspace_busy" if stopping else "ui_unavailable"
    )


@pytest.mark.asyncio
async def test_timeout_result_is_inspectable_and_cannot_be_replayed(monkeypatch):
    access = LocalAccess()
    caller = access.verify(access.native_token, "control")
    operations = Operations()
    operation_id = str(uuid.uuid4())
    real_wait_for = asyncio.wait_for

    async def short_deadline(awaitable, timeout):
        return await real_wait_for(awaitable, timeout=0.01)

    monkeypatch.setattr("sqlrooms.agent.operations.asyncio.wait_for", short_deadline)
    cancelled = asyncio.Event()

    async def invoke():
        try:
            await asyncio.Future()
        finally:
            cancelled.set()

    result = await operations.run(caller, operation_id, invoke)
    assert cancelled.is_set()
    assert result["ok"] is False and result["code"] == "timeout"
    assert result["operationId"] == operation_id
    status = operations.status(caller, operation_id)
    assert status["status"] == "timed_out_outcome_uncertain"
    assert status["result"] == result
    with pytest.raises(WorkspaceError, match="already submitted"):
        await operations.run(caller, operation_id, invoke)


@pytest.mark.parametrize(
    "failure",
    [
        subprocess.TimeoutExpired("claude", 30),
        OSError("not executable"),
        subprocess.CalledProcessError(1, "claude"),
    ],
)
def test_plugin_process_failures_are_structured(monkeypatch, failure):
    monkeypatch.setattr(code_plugin.shutil, "which", lambda _: "/test/claude")
    monkeypatch.setattr(code_plugin.subprocess, "run", Mock(side_effect=failure))
    with pytest.raises(WorkspaceError) as error:
        code_plugin.command("list")
    assert error.value.result["code"] == "plugin_setup_failed"


@pytest.mark.asyncio
@pytest.mark.parametrize("managed", [True, False])
async def test_catalog_failure_only_blocks_managed_launch_and_cleanup_continues(
    tmp_path, monkeypatch, managed
):
    server = SqlroomsHttpServer(
        str(tmp_path / "workspace.duckdb"),
        "127.0.0.1",
        43000,
        43001,
        mcp_port=43002,
        serve_ui=False,
        open_browser=False,
    )
    server.agent_runtime.managed = managed
    server.agent_runtime.catalog.path.write_text("{broken", encoding="utf-8")
    monkeypatch.setattr(server, "_start_duckdb_backend", server._duckdb_ready.set)
    monkeypatch.setattr(
        process, "reserve_managed_listeners", lambda _: (Mock(), Mock())
    )
    monkeypatch.setattr(
        registry, "remove", Mock(side_effect=RuntimeError("storage unavailable"))
    )
    stop = AsyncMock()
    close = AsyncMock()
    monkeypatch.setattr(server, "_stop_mcp", stop)
    monkeypatch.setattr(server.mcp_broker, "close", close)
    published = asyncio.Event()
    original_publish = server.agent_runtime.publish

    async def publish():
        try:
            await original_publish()
        finally:
            published.set()

    monkeypatch.setattr(server.agent_runtime, "publish", publish)

    class Http:
        started = True
        should_exit = False

        async def serve(self, **kwargs):
            while not self.should_exit:
                await asyncio.sleep(0.001)

    http = Http()
    monkeypatch.setattr("sqlrooms.web.launcher.uvicorn.Server", lambda _: http)

    async def session():
        await published.wait()
        if managed:
            await asyncio.Future()
        assert not http.should_exit
        return 7

    token = server.access.native_token
    if managed:
        with pytest.raises(WorkspaceError, match="Cannot read"):
            await asyncio.wait_for(server.start(session), 2)
    else:
        assert await asyncio.wait_for(server.start(session), 2) == 7
    assert http.should_exit
    stop.assert_awaited_once()
    close.assert_awaited_once()
    assert not server.credential_file.path.exists()
    with pytest.raises(AccessDenied):
        server.access.verify(token, "read")


def test_failed_launch_remembers_selected_profile(tmp_path, monkeypatch):
    catalog = Catalog()
    commands = []

    def fail(database, workspace_id, command, **kwargs):
        commands.append(command)
        assert catalog.get(workspace_id)["profile"] == "document-charts-maps"
        raise OSError("spawn failed")

    monkeypatch.setattr(process, "spawn_pending", fail)
    with pytest.raises(OSError, match="spawn failed"):
        Manager(catalog).open(create={"name": "Saved"})
    entry = catalog.read()[0]
    with pytest.raises(OSError, match="spawn failed"):
        Manager(catalog).open(workspaceId=entry["workspaceId"])
    assert all(
        command[command.index("--profile") + 1] == "document-charts-maps"
        for command in commands
    )


@pytest.mark.parametrize("publish_success", [True, False])
def test_spawn_waits_for_pending_publication(tmp_path, monkeypatch, publish_success):
    output = tmp_path / "started"
    command = [
        sys.executable,
        "-c",
        "import pathlib,sys; pathlib.Path(sys.argv[1]).touch()",
        str(output),
    ]
    original_mark = process.mark_pending

    def mark(database, pid, workspace_id):
        assert not output.exists()
        if not publish_success:
            raise OSError("publication failed")
        original_mark(database, pid, workspace_id)

    monkeypatch.setattr(process, "mark_pending", mark)
    database = str(tmp_path / "test.duckdb")
    if publish_success:
        child = process.spawn_pending(database, "saved", command, env=os.environ.copy())
        assert child.wait(timeout=5) == 0
        assert output.exists()
        assert (
            json.loads(process.pending_path(database).read_text())["pid"] == child.pid
        )
    else:
        with pytest.raises(OSError, match="publication failed"):
            process.spawn_pending(database, "saved", command, env=os.environ.copy())
        assert not output.exists()


def test_launch_gate_exits_when_parent_disappears(tmp_path):
    output = tmp_path / "started"
    read_fd, write_fd = os.pipe()
    with os.fdopen(read_fd, "rb") as reader:
        child = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "sqlrooms.agent.process",
                str(read_fd),
                sys.executable,
                "-c",
                "import pathlib,sys; pathlib.Path(sys.argv[1]).touch()",
                str(output),
            ],
            pass_fds=(reader.fileno(),),
        )
    os.close(write_fd)
    assert child.wait(timeout=5) == 1
    assert not output.exists()
