"""Roomie never adopts SQLRooms process state or its configurable profiles."""

import copy
import os
import sys

import pytest

from roomie import cli
from roomie.settings import settings
from sqlrooms.agent import registry
from sqlrooms.agent.catalog import Catalog
from sqlrooms.agent.connector import Connector, tools
from sqlrooms.agent.contract import CONTRACT
from sqlrooms.agent.settings import ApplicationSettings
from sqlrooms.agent.storage import WorkspaceError


@pytest.mark.parametrize(
    "flag",
    [
        "--profile",
        "--execution-mode",
        "--mcp",
        "--no-mcp",
        "--ai",
        "--config",
        "--provider",
        "--model",
        "--sync",
    ],
)
def test_cli_rejects_removed_sqlrooms_flags(flag, monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["roomie", flag])
    with pytest.raises(SystemExit) as exc:
        cli.main()
    assert exc.value.code == 2
    assert "unrecognized arguments" in capsys.readouterr().err


def test_catalog_registry_and_launch_policy_are_isolated(tmp_path, monkeypatch):
    roomie = settings()
    sqlrooms = ApplicationSettings()
    roomie_catalog, sqlrooms_catalog = Catalog(roomie), Catalog(sqlrooms)
    database = str(tmp_path / "shared.duckdb")
    roomie_entry = roomie_catalog.register(database, name="Roomie name")
    sqlrooms_entry = sqlrooms_catalog.register(database, name="SQLRooms name")
    assert roomie_entry["workspaceId"] != sqlrooms_entry["workspaceId"]
    assert roomie_catalog.read() == [roomie_entry]
    assert sqlrooms_catalog.read() == [sqlrooms_entry]
    monkeypatch.setattr(registry, "process_marker", lambda pid: "same-process")
    for app, entry in ((roomie, roomie_entry), (sqlrooms, sqlrooms_entry)):
        registry.publish(
            {
                **entry,
                "application": app.product,
                "instanceId": app.product,
                "pid": os.getpid(),
                "processMarker": "same-process",
            },
            settings=app,
        )
    assert [entry["application"] for entry in registry.records(settings=roomie)] == [
        "roomie"
    ]
    assert [entry["application"] for entry in registry.records()] == ["sqlrooms"]
    registry.remove("roomie", settings=roomie)
    assert registry.records(settings=roomie) == []
    assert len(registry.records()) == 1
    assert roomie.launch_command(database, None) == [
        sys.executable,
        "-m",
        "roomie",
        "--db-path",
        database,
        "--no-open-browser",
    ]
    assert "--profile" in sqlrooms.launch_command(database, "default")


def test_roomie_contract_does_not_mutate_sqlrooms_or_allow_profile_selection():
    original = copy.deepcopy(CONTRACT)
    roomie = settings()
    roomie_tools = {tool["name"]: tool for tool in tools(roomie)}
    assert "profile" not in roomie_tools["open_workspace"]["inputSchema"]["properties"]
    for tool in roomie.contract["tools"]:
        assert "instanceId" in roomie_tools[tool["name"]]["inputSchema"]["required"]
    assert CONTRACT == original
    assert (
        "profile"
        in next(tool for tool in tools() if tool["name"] == "open_workspace")[
            "inputSchema"
        ]["properties"]
    )
    with pytest.raises(WorkspaceError) as exc:
        Connector(settings=roomie).manager.open(path=":memory:", profile="default")
    assert exc.value.result["code"] == "invalid_profile"


def test_registry_rejects_another_application_even_with_matching_binding(monkeypatch):
    record = {"instanceId": "same", "workspaceId": "same-workspace"}
    monkeypatch.setattr(
        registry,
        "request",
        lambda *args, **kwargs: {**record, "application": "sqlrooms"},
    )
    with pytest.raises(WorkspaceError) as exc:
        registry.verify(record, settings=settings())
    assert exc.value.result["code"] == "wrong_application"
