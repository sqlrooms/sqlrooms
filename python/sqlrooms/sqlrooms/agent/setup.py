"""Previewable client setup; preserve user-owned entries and install no software."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import sys
import zipfile

from .storage import WorkspaceError, atomic_json, home, lock
from .permissions import (
    apply_permissions,
    permission_change,
    permissions_preview,
    read_object,
    recover_permissions,
    write_client_json,
)


def configuration():
    return {"command": sys.executable, "args": ["-m", "sqlrooms", "agent", "connect"]}


def manifest_path(client: str):
    # Preview must not create the SQLRooms home or client directories.
    root = Path(
        os.environ.get("SQLROOMS_HOME", str(Path.home() / ".sqlrooms"))
    ).expanduser()
    return root / ("setup-" + client + ".json")


def setup_plan(client: str, *, uninstall=False, trust_tools=True):
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
    if client == "claude-code" and os.environ.get("CLAUDE_CONFIG_DIR"):
        path = (
            Path(os.environ["CLAUDE_CONFIG_DIR"]).expanduser().resolve()
            / ".claude.json"
        )
    plan = {
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

    if client == "claude-code":
        plan["toolPermissions"] = permissions_preview(
            recover_permissions(read_object(manifest_path(client))),
            trust=trust_tools and not uninstall,
        )
    return plan


def apply_setup(plan):
    if plan["client"] == "claude-code" and not shutil.which("claude"):
        raise WorkspaceError(
            "client_missing",
            "Install Claude Code explicitly before setup; no software was installed.",
        )
    path = Path(plan["configurationPath"])
    ownership_path = manifest_path(plan["client"])
    plugin = Path(__file__).resolve().parents[1] / "claude_plugin"
    skill = plugin / "skills/sqlrooms"
    uninstalling = plan["action"] == "uninstall"
    permission_plan = (
        plan.get("toolPermissions") if plan["client"] == "claude-code" else None
    )
    with lock("setup:" + str(path)):
        current = read_object(path)
        previous = recover_permissions(read_object(ownership_path))
        servers = current.setdefault("mcpServers", {})
        if not isinstance(servers, dict):
            raise WorkspaceError(
                "configuration_invalid",
                "Client MCP configuration is malformed; preserved.",
            )
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
        # Validate permission settings before changing MCP configuration or plugins.
        if permission_plan:
            permission_change(
                Path(permission_plan["settingsPath"]),
                previous,
                permission_plan["allow"],
            )
        if uninstalling:
            if plan["client"] == "claude-code" and previous.get("nativePlugin"):
                from .code_plugin import uninstall

                uninstall()
            if permission_plan:
                apply_permissions(permission_plan, previous, ownership_path)
            if existing is not None and existing == previous.get("entry"):
                del servers["sqlrooms"]
                write_client_json(path, current)
            ownership_path.unlink(missing_ok=True)
            return {
                "ok": True,
                "message": "Removed only SQLRooms-managed configuration and permission entries. Remove uploaded Desktop guidance through the client's Skills UI.",
            }
        if not (skill / "SKILL.md").is_file():
            raise WorkspaceError(
                "guidance_missing",
                "Packaged guidance is missing. Reinstall the complete SQLRooms wheel.",
            )
        servers["sqlrooms"] = desired
        write_client_json(path, current)
        previous = {**previous, "entry": desired}
        atomic_json(ownership_path, previous)
        if plan["client"] == "claude-code":
            from .code_plugin import install

            plugin_id = install(plugin)
            previous = {**previous, "nativePlugin": plugin_id}
            atomic_json(ownership_path, previous)
        # Native plugin installation also writes settings.json. Merge the latest
        # contents now, preserving its changes and previously owned grant entries.
        if permission_plan:
            previous = apply_permissions(permission_plan, previous, ownership_path)
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
        **({"toolPermissions": permission_plan} if permission_plan else {}),
        "message": "Configuration is current. Restart the selected client; native guidance loading still requires the indicated client step.",
    }
