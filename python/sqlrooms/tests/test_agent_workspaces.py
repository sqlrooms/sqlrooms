"""Catalog/lifecycle contracts, including failures that must not destroy user state."""

import asyncio
import json
from pydantic import TypeAdapter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import threading
import time
import uuid

import duckdb
import pytest
from typer.testing import CliRunner

from sqlrooms.agent.availability import Availability
from sqlrooms.agent.catalog import Catalog
from sqlrooms.agent.connector import tools
from sqlrooms.agent.contract import CONTRACT, matches_browser
from sqlrooms.agent.manager import Manager
from sqlrooms.agent.operations import Operations
from sqlrooms.agent.storage import WorkspaceError, home
from sqlrooms.cli import app
from sqlrooms.server.access import LocalAccess


@pytest.fixture(autouse=True)
def private_home(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLROOMS_HOME", str(tmp_path / "home"))
    monkeypatch.delenv("SQLROOMS_WORKSPACES_DIR", raising=False)


def database(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(str(path)) as connection:
        connection.execute("create table if not exists sample as select 42 as answer")
    return str(path)


def test_catalog_stable_identity_alias_copy_and_missing(tmp_path):
    catalog = Catalog()
    path = database(tmp_path / "source.duckdb")
    original = catalog.register(path)
    alias = tmp_path / "alias.duckdb"
    alias.symlink_to(path)
    assert catalog.register(str(alias))["workspaceId"] == original["workspaceId"]
    import shutil

    copy = tmp_path / "copy.duckdb"
    shutil.copy(path, copy)
    assert catalog.register(str(copy))["workspaceId"] != original["workspaceId"]
    Path(path).unlink()
    assert Catalog().get(original["workspaceId"])["databasePath"] == path
    with pytest.raises(WorkspaceError) as exc:
        Manager(catalog).open(workspaceId=original["workspaceId"], openBrowser=False)
    assert exc.value.result["code"] == "workspace_unavailable"
    assert not Path(path).exists()


def test_catalog_updates_are_locked_and_malformed_data_is_preserved(tmp_path):
    catalog = Catalog()
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(
            pool.map(
                lambda n: catalog.register(str(tmp_path / f"{n}.duckdb")), range(50)
            )
        )
    assert len(catalog.read()) == 50
    catalog.path.write_text("{broken")
    with pytest.raises(WorkspaceError):
        catalog.register(str(tmp_path / "another.duckdb"))
    assert catalog.path.read_text() == "{broken"


def test_discovery_forget_and_locate(tmp_path):
    catalog = Catalog()
    managed = database(home() / "workspaces/project/workspace.duckdb")
    outside = database(tmp_path / "outside/workspace.duckdb")
    (home() / "workspaces/escape").symlink_to(Path(outside).parent)
    catalog.discover()
    assert [e["databasePath"] for e in catalog.read()] == [managed]
    entry = catalog.read()[0]
    catalog.forget(entry["workspaceId"])
    assert Path(managed).exists()
    catalog.discover()
    assert len(catalog.read()) == 1
    external = catalog.register(outside)
    replacement = database(tmp_path / "replacement.duckdb")
    with pytest.raises(WorkspaceError):
        catalog.locate(external["workspaceId"], managed, confirmed=True, live_ids=set())
    with pytest.raises(WorkspaceError):
        catalog.locate(
            external["workspaceId"],
            replacement,
            confirmed=True,
            live_ids={external["workspaceId"]},
        )
    located = catalog.locate(
        external["workspaceId"], replacement, confirmed=True, live_ids=set()
    )
    assert located["workspaceId"] == external["workspaceId"]
    assert located["databasePath"] == replacement


def test_availability_budget_cache_coalescing_and_recovery():
    release = threading.Event()
    calls = []

    def check(path):
        calls.append(path)
        if path == "stalled":
            release.wait(10)
        return {"availability": "available"}

    availability = Availability(probe_fn=check)
    paths = ["stalled", *map(str, range(199))]
    start = time.monotonic()
    results = availability.check(paths, budget=0.1)
    assert time.monotonic() - start < 2
    assert results["stalled"]["reason"] == "timeout"
    assert sum(v["availability"] == "available" for v in results.values()) == 199
    availability.check(paths, budget=0.01)
    assert len(calls) == 200
    availability.check(["stalled"], refresh=True, budget=0.01)
    assert calls.count("stalled") == 1
    release.set()
    assert (
        availability.check(["stalled"], budget=1, refresh=True)["stalled"][
            "availability"
        ]
        == "available"
    )


def test_list_pagination_retains_history_and_reports_missing(tmp_path):
    catalog = Catalog()
    for n in range(200):
        catalog.register(str(tmp_path / f"{n}.duckdb"))
    start = time.monotonic()
    listed = Manager(catalog).list(limit=200, refresh=True)
    assert time.monotonic() - start < 2
    assert listed["total"] == 200
    assert all(
        e["availability"] == "missing" and not e["instances"]
        for e in listed["workspaces"]
    )
    assert Manager(catalog).list(limit=10)["nextOffset"] == 10
    assert len(catalog.read()) == 200


def test_static_tool_surface_with_zero_workspaces():
    surface = tools()
    assert len(surface) == 11
    assert matches_browser(list(reversed(CONTRACT["tools"])))
    for tool in surface[5:]:
        assert "instanceId" in tool["inputSchema"]["required"]
    assert "instanceId" not in CONTRACT["tools"][0]["inputSchema"]["properties"]


def test_agent_group_and_explicit_path_ambiguity():
    runner = CliRunner()
    assert runner.invoke(app, ["agent", "status"]).exit_code == 0
    assert runner.invoke(app, ["agent", "connect", "--help"]).exit_code == 0
    assert runner.invoke(app, ["agent", "setup", "--yes"]).exit_code == 1


@pytest.mark.asyncio
async def test_explicit_cancel_scoped_races_and_disconnect():
    access = LocalAccess()
    caller = access.verify(access.native_token, "control")
    other = access.verify(access.issue("connector", frozenset({"control"})), "control")
    operations = Operations()
    operation = str(uuid.uuid4())
    started = asyncio.Event()
    finished = asyncio.Event()

    async def invoke():
        started.set()
        await finished.wait()
        return {"ok": True}

    response = asyncio.create_task(operations.run(caller, operation, invoke))
    await started.wait()
    operations.cancel(other, operation)
    assert not response.done()
    response.cancel()  # HTTP response loss does not cancel the operation.
    with pytest.raises(asyncio.CancelledError):
        await response
    assert operations.status(caller, operation)["status"] == "pending"
    operations.cancel(caller, operation)
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert operations.status(caller, operation)["status"] in {
        "cancellation_requested",
        "cancelled_outcome_uncertain",
    }
    early = str(uuid.uuid4())
    operations.cancel(caller, early)
    with pytest.raises(WorkspaceError):
        await operations.run(caller, early, invoke)
    operations.cancel(caller, early)


def test_profile_transition_refused_without_touching_saved_file(tmp_path):
    path = database(tmp_path / "dashboard.duckdb")
    catalog = Catalog()
    entry = catalog.register(path, profile="default")
    before = Path(path).read_bytes()
    with pytest.raises(WorkspaceError) as exc:
        Manager(catalog).open(
            workspaceId=entry["workspaceId"], profile="document-charts-maps"
        )
    assert exc.value.result["code"] == "profile_transition_unverified"
    assert Path(path).read_bytes() == before


def test_forget_running_managed_workspace_keeps_live_identity(tmp_path, monkeypatch):
    catalog = Catalog()
    path = database(home() / "workspaces/active/workspace.duckdb")
    entry = catalog.register(path)
    instance = {
        "workspaceId": entry["workspaceId"],
        "instanceId": "live",
        "databasePath": path,
        "name": entry["name"],
        "verified": True,
    }
    catalog.forget(entry["workspaceId"])
    manager = Manager(catalog)
    monkeypatch.setattr(manager, "live", lambda: [instance])
    listed = manager.list()
    assert listed["total"] == 1
    assert listed["workspaces"][0]["workspaceId"] == entry["workspaceId"]
    assert len(listed["workspaces"][0]["instances"]) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("explicit", [False, True])
async def test_sdk_eof_is_not_explicit_cancellation(explicit):
    import anyio
    import mcp.types as types
    from mcp.server import Server
    from mcp.shared.message import SessionMessage
    from sqlrooms.agent.connector import explicit_cancellation

    incoming, read = anyio.create_memory_object_stream(10)
    write, outgoing = anyio.create_memory_object_stream(10)
    started = asyncio.Event()
    observations = []

    async def call(context, params):
        started.set()
        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            observations.append(explicit_cancellation(context))
            raise

    server = Server("test", on_call_tool=call)

    async def run():
        await server.run(read, write, server.create_initialization_options())

    task = asyncio.create_task(run())
    await incoming.send(
        SessionMessage(
            TypeAdapter(types.JSONRPCMessage).validate_python(
                {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2025-11-25",
                        "capabilities": {},
                        "clientInfo": {"name": "test", "version": "1"},
                    },
                }
            )
        )
    )
    await outgoing.receive()
    await incoming.send(
        SessionMessage(
            TypeAdapter(types.JSONRPCMessage).validate_python(
                {"jsonrpc": "2.0", "method": "notifications/initialized"}
            )
        )
    )
    await incoming.send(
        SessionMessage(
            TypeAdapter(types.JSONRPCMessage).validate_python(
                {
                    "jsonrpc": "2.0",
                    "id": 2,
                    "method": "tools/call",
                    "params": {"name": "query", "arguments": {}},
                }
            )
        )
    )
    await asyncio.wait_for(started.wait(), 2)
    if explicit:
        await incoming.send(
            SessionMessage(
                TypeAdapter(types.JSONRPCMessage).validate_python(
                    {
                        "jsonrpc": "2.0",
                        "method": "notifications/cancelled",
                        "params": {"requestId": 2},
                    }
                )
            )
        )
        for _ in range(100):
            if observations:
                break
            await asyncio.sleep(0.001)
    await incoming.aclose()
    await asyncio.wait_for(task, 2)
    assert observations == [explicit]


def test_setup_preserves_custom_settings_and_only_uninstalls_owned_entry(
    tmp_path, monkeypatch
):
    from sqlrooms.agent.setup import apply_setup, configuration

    monkeypatch.setattr(
        "sqlrooms.agent.code_plugin.install", lambda source: "sqlrooms@sqlrooms-local"
    )
    monkeypatch.setattr("sqlrooms.agent.code_plugin.uninstall", lambda: None)
    config = tmp_path / "claude.json"
    config.write_text('{"theme":"dark","mcpServers":{"other":{"command":"other"}}}')
    plan = {
        "client": "claude-code",
        "configurationPath": str(config),
        "action": "install",
        "guidance": "test",
    }
    apply_setup(plan)
    apply_setup(plan)
    value = json.loads(config.read_text())
    assert value["theme"] == "dark" and value["mcpServers"]["other"] == {
        "command": "other"
    }
    assert value["mcpServers"]["sqlrooms"] == configuration()
    apply_setup({**plan, "action": "uninstall"})
    assert "sqlrooms" not in json.loads(config.read_text())["mcpServers"]
    value["mcpServers"]["sqlrooms"] = {"command": "user-owned"}
    config.write_text(json.dumps(value))
    with pytest.raises(WorkspaceError):
        apply_setup(plan)
    assert json.loads(config.read_text()) == value


def test_pending_start_prevents_duplicate_launch(monkeypatch):
    from sqlrooms.agent.process import check_pending, mark_pending

    monkeypatch.setattr(
        "sqlrooms.agent.registry.process_marker", lambda pid: "same-start"
    )
    mark_pending("/tmp/pending.duckdb", 123, "saved-id")
    with pytest.raises(WorkspaceError) as exc:
        check_pending("/tmp/pending.duckdb")
    assert exc.value.result["code"] == "startup_pending"
    monkeypatch.setattr(
        "sqlrooms.agent.registry.process_marker", lambda pid: "reused-pid"
    )
    check_pending("/tmp/pending.duckdb")


def test_listener_allocation_retries_collision():
    from sqlrooms.agent.process import reserve_listener
    import socket

    with socket.socket() as occupied:
        occupied.bind(("127.0.0.1", 0))
        replacement = reserve_listener("127.0.0.1", occupied.getsockname()[1])
        try:
            assert replacement.getsockname()[1] != occupied.getsockname()[1]
        finally:
            replacement.close()


def test_dead_launcher_with_unknown_marker_can_be_retried(monkeypatch):
    from sqlrooms.agent.process import check_pending, mark_pending, pending_path

    monkeypatch.setattr("sqlrooms.agent.registry.process_marker", lambda pid: None)

    def dead(pid, signal):
        raise ProcessLookupError()

    monkeypatch.setattr("sqlrooms.agent.process.os.kill", dead)
    mark_pending("/tmp/dead-launch.duckdb", 123, "saved")
    check_pending("/tmp/dead-launch.duckdb")
    assert not pending_path("/tmp/dead-launch.duckdb").exists()


def test_unknown_live_launcher_never_causes_duplicate(monkeypatch):
    from sqlrooms.agent.process import check_pending, mark_pending

    monkeypatch.setattr("sqlrooms.agent.registry.process_marker", lambda pid: None)
    monkeypatch.setattr("sqlrooms.agent.process.os.kill", lambda pid, signal: None)
    mark_pending("/tmp/unknown-launch.duckdb", 123, "saved")
    with pytest.raises(WorkspaceError) as exc:
        check_pending("/tmp/unknown-launch.duckdb")
    assert exc.value.result["code"] == "startup_unknown"


def test_code_plugin_does_not_adopt_user_installation(tmp_path, monkeypatch):
    from sqlrooms.agent import code_plugin

    calls = []

    def command(*args):
        calls.append(args)
        return (
            json.dumps([{"id": code_plugin.PLUGIN_ID}]) if args[0] == "list" else "[]"
        )

    monkeypatch.setattr(code_plugin, "command", command)
    with pytest.raises(WorkspaceError) as exc:
        code_plugin.install(tmp_path)
    assert exc.value.result["code"] == "guidance_conflict"
    assert calls == [("list", "--json"), ("marketplace", "list", "--json")]
