"""Setup permission changes use disposable client configuration only."""

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from sqlrooms.agent import permissions, setup
from sqlrooms.agent.connector import tools
from sqlrooms.agent.storage import WorkspaceError
from sqlrooms.cli import app


@pytest.fixture(autouse=True)
def isolated_client(tmp_path, monkeypatch):
    user_home = tmp_path / "user"
    user_home.mkdir()
    monkeypatch.setenv("HOME", str(user_home))
    monkeypatch.setenv("SQLROOMS_HOME", str(tmp_path / "sqlrooms"))
    monkeypatch.delenv("CLAUDE_CONFIG_DIR", raising=False)
    monkeypatch.setattr("sqlrooms.agent.setup.shutil.which", lambda _: "/test/claude")
    monkeypatch.setattr(
        "sqlrooms.agent.code_plugin.install", lambda _: "sqlrooms@sqlrooms-local"
    )
    monkeypatch.setattr("sqlrooms.agent.code_plugin.uninstall", lambda: None)


def write_settings(value):
    path = permissions.settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))
    return path


def test_dry_run_previews_exact_tools_and_lifecycle_scope_without_writing():
    result = CliRunner().invoke(
        app, ["agent", "setup", "--client", "claude-code", "--dry-run"]
    )
    assert result.exit_code == 0, result.output
    plan = json.loads(result.output)
    preview = plan["toolPermissions"]
    assert preview["allow"] == [f"mcp__sqlrooms__{tool['name']}" for tool in tools()]
    assert len(preview["allow"]) == 11
    assert preview["add"] == preview["allow"]
    assert all("*" not in rule for rule in preview["allow"])
    assert "closing" in preview["description"] and "browser" in preview["description"]
    assert not Path(plan["configurationPath"]).exists()
    assert not permissions.settings_path().exists()
    assert not setup.manifest_path("claude-code").parent.exists()


def test_repeat_setup_and_uninstall_preserve_user_rules_and_other_settings():
    initial = {
        "theme": "dark",
        "permissions": {
            "allow": ["Read", "mcp__sqlrooms__query", "mcp__other__read"],
            "ask": ["mcp__sqlrooms__execute_command"],
            "deny": ["mcp__sqlrooms__query"],
            "defaultMode": "default",
        },
        "hooks": {"SessionStart": []},
    }
    path = write_settings(initial)
    setup.apply_setup(setup.setup_plan("claude-code"))
    setup.apply_setup(setup.setup_plan("claude-code"))
    current = json.loads(path.read_text())
    assert current["theme"] == "dark" and current["hooks"] == initial["hooks"]
    assert current["permissions"]["ask"] == initial["permissions"]["ask"]
    assert current["permissions"]["deny"] == initial["permissions"]["deny"]
    assert current["permissions"]["defaultMode"] == "default"
    assert len(current["permissions"]["allow"]) == len(
        set(current["permissions"]["allow"])
    )
    owned = json.loads(setup.manifest_path("claude-code").read_text())[
        "toolPermissions"
    ]["allow"]
    assert "mcp__sqlrooms__query" not in owned
    preview = setup.setup_plan("claude-code", uninstall=True)
    assert set(preview["toolPermissions"]["remove"]) == set(owned)
    setup.apply_setup(preview)
    assert json.loads(path.read_text()) == initial
    assert not setup.manifest_path("claude-code").exists()
    setup.apply_setup(setup.setup_plan("claude-code", uninstall=True))
    assert json.loads(path.read_text()) == initial


def test_no_trust_leaves_new_settings_absent_and_removes_only_owned_grants():
    setup.apply_setup(setup.setup_plan("claude-code", trust_tools=False))
    assert not permissions.settings_path().exists()
    path = write_settings({"permissions": {"allow": ["mcp__sqlrooms__query"]}})
    setup.apply_setup(setup.setup_plan("claude-code"))
    setup.apply_setup(setup.setup_plan("claude-code", trust_tools=False))
    assert json.loads(path.read_text())["permissions"]["allow"] == [
        "mcp__sqlrooms__query"
    ]
    assert json.loads(
        Path(setup.setup_plan("claude-code")["configurationPath"]).read_text()
    )["mcpServers"]["sqlrooms"]


def test_uninstall_cleans_grants_even_when_mcp_entry_was_already_removed():
    plan = setup.setup_plan("claude-code")
    setup.apply_setup(plan)
    Path(plan["configurationPath"]).write_text('{"mcpServers":{}}')
    setup.apply_setup(setup.setup_plan("claude-code", uninstall=True))
    assert (
        json.loads(permissions.settings_path().read_text())["permissions"]["allow"]
        == []
    )


def test_modified_and_duplicated_user_entries_survive_uninstall():
    setup.apply_setup(setup.setup_plan("claude-code"))
    current = json.loads(permissions.settings_path().read_text())
    current["permissions"]["allow"].remove("mcp__sqlrooms__query")
    current["permissions"]["allow"] += [
        "mcp__sqlrooms__*",
        "mcp__sqlrooms__list_tables",
    ]
    path = write_settings(current)
    setup.apply_setup(setup.setup_plan("claude-code", trust_tools=False))
    setup.apply_setup(setup.setup_plan("claude-code", uninstall=True))
    assert json.loads(path.read_text())["permissions"]["allow"] == [
        "mcp__sqlrooms__*",
        "mcp__sqlrooms__list_tables",
    ]


@pytest.mark.parametrize(
    "value",
    [
        [],
        {"permissions": None},
        {"permissions": {"allow": "Read"}},
        {"permissions": {"ask": [1]}},
        {"permissions": {"deny": None}},
    ],
)
def test_malformed_settings_fail_before_configuration_changes(value):
    plan = setup.setup_plan("claude-code")
    path = write_settings(value)
    original = path.read_bytes()
    with pytest.raises(WorkspaceError, match="preserved"):
        setup.apply_setup(plan)
    assert path.read_bytes() == original
    assert not Path(plan["configurationPath"]).exists()


def test_plugin_settings_changes_are_preserved_and_failures_grant_no_permissions(
    monkeypatch,
):
    plan = setup.setup_plan("claude-code")

    def failing_install(_):
        raise WorkspaceError("plugin_setup_failed", "Test failure")

    monkeypatch.setattr("sqlrooms.agent.code_plugin.install", failing_install)
    with pytest.raises(WorkspaceError, match="Test failure"):
        setup.apply_setup(plan)
    assert not permissions.settings_path().exists()

    def successful_install(_):
        write_settings(
            {
                "enabledPlugins": {"sqlrooms@sqlrooms-local": True},
                "permissions": {"allow": ["Read"]},
            }
        )
        return "sqlrooms@sqlrooms-local"

    monkeypatch.setattr("sqlrooms.agent.code_plugin.install", successful_install)
    setup.apply_setup(plan)
    value = json.loads(permissions.settings_path().read_text())
    assert value["enabledPlugins"] == {"sqlrooms@sqlrooms-local": True}
    assert "Read" in value["permissions"]["allow"]


@pytest.mark.parametrize("failure", ["settings", "ownership"])
def test_interrupted_grant_is_recoverable_on_uninstall(monkeypatch, failure):
    plan = setup.setup_plan("claude-code")
    real_save = permissions.atomic_json
    real_write = permissions.write_client_json

    def fail_ownership(path, value):
        if "toolPermissions" in value and "pendingToolPermissions" not in value:
            raise OSError("Simulated ownership save failure")
        real_save(path, value)

    def fail_settings(path, value):
        raise OSError("Simulated settings save failure")

    monkeypatch.setattr(
        permissions,
        "atomic_json",
        fail_ownership if failure == "ownership" else real_save,
    )
    monkeypatch.setattr(
        permissions,
        "write_client_json",
        fail_settings if failure == "settings" else real_write,
    )
    with pytest.raises(OSError, match="Simulated"):
        setup.apply_setup(plan)
    assert "pendingToolPermissions" in json.loads(
        setup.manifest_path("claude-code").read_text()
    )
    monkeypatch.setattr(permissions, "atomic_json", real_save)
    monkeypatch.setattr(permissions, "write_client_json", real_write)
    setup.apply_setup(setup.setup_plan("claude-code", uninstall=True))
    assert (
        permissions.read_object(permissions.settings_path())
        .get("permissions", {})
        .get("allow", [])
        == []
    )


def test_conflicting_edit_after_interruption_is_preserved(monkeypatch):
    real_save = permissions.atomic_json

    def fail(path, value):
        if "toolPermissions" in value and "pendingToolPermissions" not in value:
            raise OSError("Interrupted")
        real_save(path, value)

    monkeypatch.setattr(permissions, "atomic_json", fail)
    with pytest.raises(OSError):
        setup.apply_setup(setup.setup_plan("claude-code"))
    path = write_settings({"permissions": {"allow": ["Read"]}})
    with pytest.raises(WorkspaceError, match="interrupted"):
        setup.setup_plan("claude-code", uninstall=True)
    assert json.loads(path.read_text()) == {"permissions": {"allow": ["Read"]}}


def test_custom_config_directory_is_used_and_cannot_orphan_previous_grants(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", "")
    plan = setup.setup_plan("claude-code")
    assert Path(plan["configurationPath"]) == Path.home() / ".claude.json"
    assert Path(plan["toolPermissions"]["settingsPath"]) == (
        Path.home() / ".claude/settings.json"
    )
    custom = tmp_path / "custom-claude"
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(custom))
    plan = setup.setup_plan("claude-code")
    assert Path(plan["configurationPath"]) == custom / ".claude.json"
    assert Path(plan["toolPermissions"]["settingsPath"]) == custom / "settings.json"
    setup.apply_setup(plan)
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path / "other-claude"))
    with pytest.raises(WorkspaceError, match="another Claude settings file"):
        setup.setup_plan("claude-code")


def test_desktop_has_no_claude_code_permission_changes(monkeypatch):
    monkeypatch.setattr("sqlrooms.agent.setup.sys.platform", "darwin")
    plan = setup.setup_plan("claude-desktop")
    assert "toolPermissions" not in plan
    setup.apply_setup(plan)
    assert not permissions.settings_path().exists()


def test_cli_yes_opt_out_and_interactive_choice(monkeypatch):
    calls = []
    monkeypatch.setattr(
        setup, "apply_setup", lambda plan: calls.append(plan) or {"ok": True}
    )
    runner = CliRunner()
    result = runner.invoke(
        app, ["agent", "setup", "--client", "claude-code", "--yes", "--no-trust-tools"]
    )
    assert result.exit_code == 0, result.output
    assert calls[-1]["toolPermissions"]["allow"] == []
    result = runner.invoke(app, ["agent", "setup", "--client", "claude-code", "--yes"])
    assert result.exit_code == 0, result.output
    assert len(calls[-1]["toolPermissions"]["allow"]) == 11
    monkeypatch.setattr("sqlrooms.agent.cli.sys.stdin.isatty", lambda: True)
    # CliRunner swaps stdin; drive the prompts through Typer's testable functions.
    choices = iter([False, True])
    monkeypatch.setattr(
        "sqlrooms.agent.cli.typer.confirm", lambda *a, **kw: next(choices)
    )
    from sqlrooms.agent.cli import setup as setup_command

    setup_command(
        client="claude-code",
        yes=False,
        dry_run=False,
        uninstall=False,
        trust_tools=None,
    )
    assert calls[-1]["toolPermissions"]["allow"] == []
