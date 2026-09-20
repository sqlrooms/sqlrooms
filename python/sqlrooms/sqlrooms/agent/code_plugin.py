"""Install only native Claude Code guidance; the global entry owns MCP transport."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

from .storage import WorkspaceError, atomic_json, home

PLUGIN_ID = "sqlrooms@sqlrooms-local"


def command(*args):
    executable = shutil.which("claude")
    if not executable:
        raise WorkspaceError(
            "client_missing",
            "Claude Code is not installed. Install it explicitly, then rerun setup; no software was installed.",
        )
    result = subprocess.run(
        [executable, "plugin", *args], capture_output=True, text=True, timeout=30
    )
    if result.returncode:
        raise WorkspaceError(
            "plugin_setup_failed",
            "Claude Code could not complete native plugin setup. Inspect `claude plugin list` and retry setup; the MCP configuration is retained.",
        )
    return result.stdout


def prepare_files(source: Path):
    root = home() / "integrations/claude-code"
    manifest_path = root / "managed-files.json"
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    files = {
        ".claude-plugin/marketplace.json": json.dumps(
            {
                "name": "sqlrooms-local",
                "owner": {"name": "SQLRooms"},
                "plugins": [{"name": "sqlrooms", "source": "./plugin"}],
            }
        ).encode(),
        "plugin/.claude-plugin/plugin.json": (
            source / ".claude-plugin/plugin.json"
        ).read_bytes(),
    }
    for path in (source / "skills").rglob("*"):
        if path.is_file():
            files["plugin/" + str(path.relative_to(source))] = path.read_bytes()
    for name, content in files.items():
        target = root / name
        if (
            target.exists()
            and target.read_bytes() != content
            and hashlib.sha256(target.read_bytes()).hexdigest() != previous.get(name)
        ):
            raise WorkspaceError(
                "guidance_conflict", f"Customized guidance preserved at {target}."
            )
    for name, content in files.items():
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    # Files are guidance, not credentials. Root metadata is owner-only.
    root.chmod(0o700)
    atomic_json(
        manifest_path,
        {name: hashlib.sha256(content).hexdigest() for name, content in files.items()},
    )
    return root


def install(source: Path):
    if (
        Path(
            os.environ.get("CLAUDE_CONFIG_DIR") or str(Path.home() / ".claude")
        ).expanduser()
        / "skills/sqlrooms"
    ).exists():
        raise WorkspaceError(
            "guidance_conflict",
            "A loose SQLRooms skill already exists. Remove or move it explicitly before installing the native plugin.",
        )
    installed = json.loads(command("list", "--json"))
    entries = installed if isinstance(installed, list) else installed.get("plugins", [])
    for entry in entries:
        identifier = entry.get("id", entry.get("name", ""))
        if identifier.startswith("sqlrooms@") and identifier != PLUGIN_ID:
            raise WorkspaceError(
                "guidance_conflict",
                "Another SQLRooms native plugin is installed. Keep one guidance installation per host.",
            )
    root = home() / "integrations/claude-code"
    ownership_path = home() / "setup-claude-code.json"
    ownership = (
        json.loads(ownership_path.read_text()) if ownership_path.exists() else {}
    )
    already_installed = any(
        entry.get("id", entry.get("name")) == PLUGIN_ID for entry in entries
    )
    marketplaces = json.loads(command("marketplace", "list", "--json"))
    existing_market = next(
        (m for m in marketplaces if m.get("name") == "sqlrooms-local"), None
    )
    owned = ownership.get("nativePlugin") == PLUGIN_ID
    if (already_installed and not owned) or (
        existing_market
        and (
            not owned
            or existing_market.get("source") != "directory"
            or Path(existing_market.get("path", "")).resolve() != root.resolve()
        )
    ):
        raise WorkspaceError(
            "guidance_conflict",
            "An existing SQLRooms plugin or marketplace is not owned by this setup. It has been preserved.",
        )
    root = prepare_files(source)
    command("marketplace", "add", str(root))
    # Record ownership immediately after creating the marketplace, so an
    # interrupted installation can be repaired without adopting foreign files.
    atomic_json(ownership_path, {**ownership, "nativePlugin": PLUGIN_ID})
    if already_installed:
        command("marketplace", "update", "sqlrooms-local")
        command("update", PLUGIN_ID)
    else:
        command("install", PLUGIN_ID, "--scope", "user")
    return PLUGIN_ID


def uninstall():
    marketplaces = json.loads(command("marketplace", "list", "--json"))
    existing = next(
        (m for m in marketplaces if m.get("name") == "sqlrooms-local"), None
    )
    root = home() / "integrations/claude-code"
    if existing and (
        existing.get("source") != "directory"
        or Path(existing.get("path", "")).resolve() != root.resolve()
    ):
        raise WorkspaceError(
            "guidance_conflict", "Customized SQLRooms marketplace and plugin preserved."
        )
    installed = json.loads(command("list", "--json"))
    entries = installed if isinstance(installed, list) else installed.get("plugins", [])
    if any(entry.get("id", entry.get("name")) == PLUGIN_ID for entry in entries):
        if not existing:
            raise WorkspaceError(
                "guidance_conflict",
                "Plugin source cannot be verified; existing plugin preserved.",
            )
        command("uninstall", PLUGIN_ID, "--scope", "user")
    if existing:
        command("marketplace", "remove", "sqlrooms-local")
