"""Claude Code permission rules owned by the SQLRooms setup operation."""

import json
import os
from pathlib import Path
import tempfile

from .storage import WorkspaceError, atomic_json


TRUST_DESCRIPTION = (
    "Trust the listed SQLRooms tools in Claude Code, including creating, opening, "
    "closing, relocating, and forgetting workspaces and editing documents. "
    "SQLRooms still asks in the browser before database writes and external or "
    "unverified reads. Existing ask, deny, and organization policies remain in force."
)


def read_object(path: Path):
    """Read client JSON without replacing malformed or inaccessible settings."""
    try:
        value = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object")
        return value
    except (OSError, ValueError) as exc:
        raise WorkspaceError(
            "configuration_invalid", f"Cannot read {path}; it has been preserved."
        ) from exc


def write_client_json(path: Path, value):
    """Atomically update client settings without changing parent permissions."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def settings_path():
    """Follow Claude Code's user-settings directory override when configured."""
    return (
        Path(os.environ.get("CLAUDE_CONFIG_DIR") or str(Path.home() / ".claude"))
        .expanduser()
        .resolve()
        / "settings.json"
    ).resolve()


def permission_rules():
    """Name the currently shipped MCP tools explicitly; never grant a wildcard."""
    from .connector import tools

    return [f"mcp__sqlrooms__{tool['name']}" for tool in tools()]


def permission_change(path: Path, previous: dict, rules: list[str]):
    """Compute an additive grant or owned-rule removal from the latest settings."""
    current = read_object(path)
    permissions = current.get("permissions", {})
    if not isinstance(permissions, dict) or any(
        not isinstance(permissions.get(key, []), list)
        or any(not isinstance(rule, str) for rule in permissions.get(key, []))
        for key in ("allow", "ask", "deny")
    ):
        raise WorkspaceError(
            "configuration_invalid", f"Malformed permissions in {path}; preserved."
        )
    owned = previous.get("toolPermissions", {})
    if not isinstance(owned, dict) or not isinstance(owned.get("allow", []), list):
        raise WorkspaceError("configuration_invalid", "Malformed permission ownership.")
    if any(not isinstance(rule, str) for rule in owned.get("allow", [])):
        raise WorkspaceError("configuration_invalid", "Malformed permission ownership.")
    if owned.get("allow") and owned.get("settingsPath") != str(path):
        raise WorkspaceError(
            "configuration_conflict",
            "SQLRooms owns permission entries in another Claude settings file. "
            "Uninstall setup using that configuration directory before switching.",
        )
    allowed = permissions.get("allow", [])
    added = [rule for rule in rules if rule not in allowed]
    removed = [
        rule for rule in owned.get("allow", []) if rule in allowed and rule not in rules
    ]
    retained = list(allowed)
    for rule in removed:
        retained.remove(rule)
    ownership = {
        "settingsPath": str(path),
        "allow": [
            rule
            for rule in owned.get("allow", [])
            if rule in retained and rule in rules
        ]
        + added,
    }
    if added or removed:
        current = {**current, "permissions": {**permissions, "allow": retained + added}}
    return current, ownership, added, removed, allowed


def permissions_preview(previous: dict, *, trust: bool):
    """Preview exactly which allow entries setup will add or remove."""
    path = settings_path()
    rules = permission_rules() if trust else []
    _, _, added, removed, _ = permission_change(path, previous, rules)
    return {
        "settingsPath": str(path),
        "trustTools": trust,
        "allow": rules,
        "add": added,
        "remove": removed,
        "description": TRUST_DESCRIPTION
        if trust
        else "Remove only allow entries previously added by SQLRooms; preserve user permissions.",
    }


def recover_permissions(previous: dict):
    """Recover a permission write interrupted between settings and ownership saves."""
    pending = previous.get("pendingToolPermissions")
    if pending is None:
        return previous
    try:
        current = read_object(Path(pending["settingsPath"]))
        allowed = current.get("permissions", {}).get("allow", [])
        if allowed == pending["afterAllow"]:
            previous = {**previous, "toolPermissions": pending["ownership"]}
        elif allowed != pending["beforeAllow"]:
            raise ValueError("Permission entries changed during interrupted setup")
    except (KeyError, TypeError, AttributeError, ValueError) as exc:
        raise WorkspaceError(
            "configuration_conflict",
            "An interrupted SQLRooms permission update conflicts with current settings. "
            "Permission entries and setup ownership have been preserved for inspection.",
        ) from exc
    return {
        key: value for key, value in previous.items() if key != "pendingToolPermissions"
    }


def apply_permissions(plan: dict, previous: dict, ownership_path: Path):
    """Merge current settings with a recoverable ownership record before writing."""
    path = Path(plan["settingsPath"])
    current, owned, added, removed, before = permission_change(
        path, previous, plan["allow"]
    )
    updated = {**previous, "toolPermissions": owned}
    if added or removed:
        atomic_json(
            ownership_path,
            {
                **previous,
                "pendingToolPermissions": {
                    "settingsPath": str(path),
                    "beforeAllow": before,
                    "afterAllow": current["permissions"]["allow"],
                    "ownership": owned,
                },
            },
        )
        write_client_json(path, current)
    atomic_json(ownership_path, updated)
    return updated
