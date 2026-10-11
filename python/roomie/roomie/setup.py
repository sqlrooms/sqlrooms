"""Previewable host configuration, scoped to the roomie registration key."""

import os
from pathlib import Path
import shutil
import sys
import tempfile

import tomlkit
from sqlrooms.agent.permissions import read_object, write_client_json
from sqlrooms.agent.storage import WorkspaceError, atomic_json, lock
from .settings import settings


def configure(client: str, *, apply=False):
    """Preview/apply supported native host configuration without replacing other entries."""
    app = settings()
    package = Path(__file__).parent
    entry = {"command": sys.executable, "args": ["-m", "roomie", "agent", "connect"]}
    if client == "codex":
        path = (
            Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
            / "config.toml"
        )
        skill_path = Path.home() / ".agents/skills/roomie/SKILL.md"
    elif client == "claude-code":
        path = (
            Path(os.environ["CLAUDE_CONFIG_DIR"]) / ".claude.json"
            if os.environ.get("CLAUDE_CONFIG_DIR")
            else Path.home() / ".claude.json"
        )
        skill_path = None
    else:
        raise WorkspaceError("invalid_client", "Choose claude-code or codex.")
    skill = package / "claude_plugin/skills/roomie/SKILL.md"
    plan = {
        "client": client,
        "configurationPath": str(path),
        "entry": {"roomie": entry},
        "guidancePath": str(skill_path or skill),
        "applied": False,
        "launch": ["claude", "--plugin-dir", str(package / "claude_plugin")]
        if client == "claude-code"
        else ["codex"],
    }
    if not apply:
        return plan
    if not shutil.which("codex" if client == "codex" else "claude"):
        raise WorkspaceError(
            "client_missing", "Install the selected host before applying configuration."
        )
    if not skill.is_file():
        raise WorkspaceError("guidance_missing", "Install the complete Roomie wheel.")
    with lock("host-setup:" + str(path), settings=app):
        manifest_path = app.home() / ("setup-" + client + ".json")
        previous = read_object(manifest_path)
        if path.is_symlink() or (skill_path and skill_path.is_symlink()):
            raise WorkspaceError(
                "configuration_conflict",
                "Symlinked host configuration is preserved; configure Roomie manually.",
            )
        current = (
            tomlkit.parse(path.read_text())
            if client == "codex" and path.exists()
            else tomlkit.document()
            if client == "codex"
            else read_object(path)
        )
        key = "mcp_servers" if client == "codex" else "mcpServers"
        servers = current.setdefault(key, {})
        existing = servers.get("roomie")
        if (
            existing is not None
            and existing != entry
            and existing != previous.get("entry")
        ):
            raise WorkspaceError(
                "configuration_conflict",
                "The roomie MCP entry is user-owned; it has been preserved.",
            )
        guidance = skill.read_text()
        if (
            skill_path
            and skill_path.exists()
            and skill_path.read_text() not in {guidance, previous.get("guidance")}
        ):
            raise WorkspaceError(
                "configuration_conflict",
                "The existing Roomie skill is user-owned; it has been preserved.",
            )
        servers["roomie"] = entry
        if client == "claude-code":
            write_client_json(path, current)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            fd, temporary = tempfile.mkstemp(dir=path.parent)
            try:
                with os.fdopen(fd, "w") as output:
                    output.write(tomlkit.dumps(current))
                    output.flush()
                    os.fsync(output.fileno())
                os.replace(temporary, path)
            finally:
                Path(temporary).unlink(missing_ok=True)
            skill_path.parent.mkdir(parents=True, exist_ok=True)
            skill_path.write_text(guidance)
        atomic_json(manifest_path, {"entry": entry, "guidance": guidance})
    return {
        **plan,
        "applied": True,
        "message": "Restart the host. For Claude Code use the returned launch command to load bundled guidance.",
    }
