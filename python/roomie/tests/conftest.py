"""Keep every Roomie test away from the user's workspaces and host configuration."""

from pathlib import Path
from types import SimpleNamespace

import pytest


@pytest.fixture(autouse=True)
def isolated_home(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    for variable in (
        "CODEX_HOME",
        "CLAUDE_CONFIG_DIR",
        "ROOMIE_MANAGED",
        "SQLROOMS_MANAGED",
        "ROOMIE_MANAGED_LOG",
    ):
        monkeypatch.delenv(variable, raising=False)
    for product in ("ROOMIE", "SQLROOMS"):
        monkeypatch.setenv(product + "_HOME", str(tmp_path / product.lower()))
        monkeypatch.setenv(
            product + "_WORKSPACES_DIR", str(tmp_path / product.lower() / "workspaces")
        )


@pytest.fixture
def server(tmp_path):
    from roomie.server import RoomieServer

    server = RoomieServer(str(tmp_path / "workspace.duckdb"), port=43000)
    server.runtime.extensions = []
    server.agent_runtime.workspace = server.agent_runtime.catalog.register(
        server.duckdb_database
    )
    server._http_server = SimpleNamespace(should_exit=False)
    return server
