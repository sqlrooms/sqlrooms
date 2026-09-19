"""Previewable client setup; preserve user-owned entries and install no software."""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import sys
import zipfile

from .storage import WorkspaceError, atomic_json, home, lock


def configuration():
    return {"command": sys.executable, "args": ["-m", "sqlrooms", "agent", "connect"]}


def setup_plan(client: str, *, uninstall=False):
    if client not in {"claude-desktop", "claude-code"}:
        raise WorkspaceError("invalid_client", "Choose claude-desktop or claude-code.")
    if client == "claude-desktop" and sys.platform != "darwin":
        raise WorkspaceError(
            "unsupported_platform",
            "Desktop setup is currently supported only on macOS.",
        )
    path = Path.home() / (
        "Library/Application Support/Claude/claude_desktop_config.json"
        if client == "claude-desktop"
        else ".claude.json"
    )
    return {
        "client": client,
        "configurationPath": str(path),
        "entry": {"sqlrooms": configuration()},
        "action": "uninstall" if uninstall else "install",
        "detected": Path("/Applications/Claude.app").exists()
        if client == "claude-desktop"
        else shutil.which("claude") is not None,
        "guidance": "Upload the generated sqlrooms-skill.zip under Customize > Skills and enable it."
        if client == "claude-desktop"
        else "Install the SQLRooms native guidance plugin from a local managed marketplace; no loose duplicate skill or optional software is installed.",
        "runtime": sys.executable,
        "guidanceCommands": [
            [
                shutil.which("claude") or "claude",
                "plugin",
                "marketplace",
                "add",
                "<SQLROOMS_HOME>/integrations/claude-code",
            ],
            [
                shutil.which("claude") or "claude",
                "plugin",
                "install",
                "sqlrooms@sqlrooms-local",
                "--scope",
                "user",
            ],
        ]
        if client == "claude-code" and not uninstall
        else [],
    }


def apply_setup(plan):
    if plan["client"] == "claude-code" and not shutil.which("claude"):
        raise WorkspaceError(
            "client_missing",
            "Install Claude Code explicitly before setup; no software was installed.",
        )
    path = Path(plan["configurationPath"])
    manifest_path = home() / ("setup-" + plan["client"] + ".json")
    with lock("setup:" + str(path)):
        try:
            current = json.loads(path.read_text()) if path.exists() else {}
            previous = (
                json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
            )
            servers = current.setdefault("mcpServers", {})
            if not isinstance(servers, dict):
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            raise WorkspaceError(
                "configuration_invalid",
                "Client configuration is malformed; it has been preserved.",
            ) from None
        existing = servers.get("sqlrooms")
        desired = configuration()
        if (
            existing is not None
            and existing != previous.get("entry")
            and existing != desired
        ):
            raise WorkspaceError(
                "configuration_conflict",
                "The sqlrooms MCP entry is user-owned or customized; it has been preserved.",
            )
        if plan["action"] == "uninstall":
            if existing is not None and existing == previous.get("entry"):
                del servers["sqlrooms"]
            else:
                return {"ok": True, "message": "No unchanged managed entry to remove."}
        else:
            servers["sqlrooms"] = desired
        # Client folders are not SQLRooms credential storage; preserve their
        # permissions and atomically replace only the JSON file.
        import os
        import tempfile

        path.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(dir=path.parent)
        try:
            with os.fdopen(fd, "w") as stream:
                json.dump(current, stream, indent=2)
                stream.write("\n")
            os.replace(temporary, path)
        finally:
            Path(temporary).unlink(missing_ok=True)
        if plan["action"] == "uninstall":
            if plan["client"] == "claude-code" and previous.get("nativePlugin"):
                from .code_plugin import uninstall

                uninstall()
            manifest_path.unlink(missing_ok=True)
            return {
                "ok": True,
                "message": "Removed only the managed MCP entry. Remove uploaded guidance through the client's Skills UI.",
            }
        atomic_json(manifest_path, {**previous, "entry": desired})
    plugin = Path(__file__).resolve().parents[1] / "claude_plugin"
    skill = plugin / "skills/sqlrooms"
    if not (skill / "SKILL.md").is_file():
        raise WorkspaceError(
            "guidance_missing",
            "Connector configured, but packaged guidance is missing. Reinstall the complete SQLRooms wheel.",
        )
    if plan["client"] == "claude-code":
        from .code_plugin import install

        plugin_id = install(plugin)
        atomic_json(manifest_path, {"entry": desired, "nativePlugin": plugin_id})
    archive = home() / "sqlrooms-skill.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
        for file in sorted(skill.rglob("*")):
            if file.is_file():
                output.write(file, Path("sqlrooms") / file.relative_to(skill))
    return {
        "ok": True,
        "configurationPath": str(path),
        "guidanceArchive": str(archive),
        "guidance": plan["guidance"],
        "codeCommand": ["claude"],
        "message": "Configuration is current. Restart the selected client; native guidance loading still requires the indicated client step.",
    }
