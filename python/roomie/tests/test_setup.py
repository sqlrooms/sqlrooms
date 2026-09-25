"""Applying host setup changes only Roomie's owned entry and guidance."""

import json
from pathlib import Path

import pytest
import tomlkit

from roomie.setup import configure
from sqlrooms.agent.storage import WorkspaceError


def read_configuration(client, path):
    return (
        tomlkit.parse(path.read_text())
        if client == "codex"
        else json.loads(path.read_text())
    )


@pytest.mark.parametrize("client", ["claude-code", "codex"])
def test_preview_is_read_only_and_apply_preserves_unrelated_entries(
    client, monkeypatch
):
    monkeypatch.setattr("roomie.setup.shutil.which", lambda _: "/test/host")
    preview = configure(client)
    path = Path(preview["configurationPath"])
    assert not path.exists()
    assert preview["applied"] is False
    path.parent.mkdir(parents=True, exist_ok=True)
    if client == "codex":
        path.write_text(
            '# Keep this comment\nmodel = "custom-model"\n[mcp_servers.sqlrooms]\ncommand = "sqlrooms"\n[mcp_servers.other]\ncommand = "other"\n'
        )
    else:
        path.write_text(
            json.dumps(
                {
                    "theme": "dark",
                    "mcpServers": {
                        "sqlrooms": {"command": "sqlrooms"},
                        "other": {"command": "other"},
                    },
                }
            )
        )
    before = read_configuration(client, path)
    assert configure(client, apply=True)["applied"] is True
    after = read_configuration(client, path)
    key = "mcp_servers" if client == "codex" else "mcpServers"
    assert after[key]["roomie"] == preview["entry"]["roomie"]
    del after[key]["roomie"]
    assert after == before
    if client == "codex":
        assert "# Keep this comment" in path.read_text()
        assert Path(preview["guidancePath"]).is_file()
    assert configure(client, apply=True)["applied"] is True


@pytest.mark.parametrize("client", ["claude-code", "codex"])
def test_setup_preserves_user_modified_roomie_registration(client, monkeypatch):
    monkeypatch.setattr("roomie.setup.shutil.which", lambda _: "/test/host")
    plan = configure(client, apply=True)
    path = Path(plan["configurationPath"])
    current = read_configuration(client, path)
    key = "mcp_servers" if client == "codex" else "mcpServers"
    current[key]["roomie"]["command"] = "/custom/roomie"
    path.write_text(
        tomlkit.dumps(current) if client == "codex" else json.dumps(current)
    )
    before = path.read_bytes()
    with pytest.raises(WorkspaceError) as exc:
        configure(client, apply=True)
    assert exc.value.result["code"] == "configuration_conflict"
    assert path.read_bytes() == before


def test_codex_guidance_conflict_preserves_existing_configuration(monkeypatch):
    monkeypatch.setattr("roomie.setup.shutil.which", lambda _: "/test/host")
    plan = configure("codex")
    guidance = Path(plan["guidancePath"])
    guidance.parent.mkdir(parents=True)
    guidance.write_text("User-owned Roomie guidance")
    with pytest.raises(WorkspaceError) as exc:
        configure("codex", apply=True)
    assert exc.value.result["code"] == "configuration_conflict"
    assert guidance.read_text() == "User-owned Roomie guidance"
    assert not Path(plan["configurationPath"]).exists()
