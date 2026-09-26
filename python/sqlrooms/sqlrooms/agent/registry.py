"""Private live registrations, authenticated binding verification, and diagnostics."""

from __future__ import annotations

from pathlib import Path
import os
import subprocess
from urllib.parse import urlsplit

import httpx

from .contract import CONTROL_VERSION, TOOL_HASH, TOOL_VERSION
from .storage import WorkspaceError, atomic_json, home, private_dir
from ..web.security import read_credential_file


def process_marker(pid: int) -> str | None:
    try:
        result = subprocess.run(
            ["/bin/ps", "-p", str(pid), "-o", "lstart="],
            capture_output=True,
            text=True,
            timeout=0.5,
        )
        return result.stdout.strip() or None
    except (OSError, subprocess.TimeoutExpired):
        return None


def publish(record: dict):
    atomic_json(
        private_dir(home() / "runtime") / (record["instanceId"] + ".json"), record
    )


def remove(instance_id: str):
    (home() / "runtime" / (instance_id + ".json")).unlink(missing_ok=True)


def records() -> list[dict]:
    directory = private_dir(home() / "runtime")
    result = []
    for index, path in enumerate(directory.glob("*.json")):
        if index >= 1000:
            break
        try:
            record = read_credential_file(path)
            if path.stem != record["instanceId"] or not isinstance(record["pid"], int):
                continue
            marker = process_marker(record["pid"])
            if marker is None or record["processMarker"] is None:
                try:
                    os.kill(record["pid"], 0)
                except ProcessLookupError:
                    path.unlink(missing_ok=True)
                    continue
                except PermissionError:
                    pass
                # Retain uncertain identities for authenticated verify().
            elif marker != record["processMarker"]:
                path.unlink(missing_ok=True)
                continue
            result.append(record)
        except (OSError, ValueError, KeyError, RuntimeError):
            continue
    return result


def credential(record: dict) -> dict:
    value = read_credential_file(Path(record["credentialFile"]))
    if value["binding"] != record["instanceId"]:
        raise WorkspaceError(
            "stale_target", "The credential belongs to another running binding."
        )
    for key in ("apiUrl", "mcpUrl"):
        parsed = urlsplit(value[key])
        if (
            parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise WorkspaceError(
                "invalid_endpoint",
                "Only local authenticated runtime endpoints are supported.",
            )
    if value["apiUrl"] != record["apiUrl"] or (
        record.get("mcpUrl") and value["mcpUrl"] != record["mcpUrl"]
    ):
        raise WorkspaceError(
            "stale_target", "Registration and credential endpoints differ."
        )
    return value


def request(record: dict, path: str, *, payload=None, token=None, timeout=2):
    auth = credential(record)
    try:
        with httpx.Client(trust_env=False, timeout=timeout) as client:
            response = client.request(
                "GET" if payload is None else "POST",
                auth["apiUrl"] + path,
                headers={"Authorization": "Bearer " + (token or auth["token"])},
                json=payload,
            )
        if response.status_code in (401, 403):
            raise WorkspaceError(
                "authentication_failed",
                "Runtime authorization failed; reopen or restart the workspace.",
            )
        response.raise_for_status()
        result = response.json()
        if result.get("ok") is False:
            raise WorkspaceError(
                result["code"],
                result["message"],
                **{
                    k: v
                    for k, v in result.items()
                    if k not in {"ok", "code", "message"}
                },
            )
        return result
    except httpx.HTTPError:
        raise WorkspaceError(
            "connection_failed",
            "The registered runtime did not answer. Check agent status; do not replay mutations.",
        ) from None


def verify(record: dict, *, tools=False, control=False) -> dict:
    value = request(record, "/api/agent/identity")
    if (
        value.get("instanceId") != record["instanceId"]
        or value.get("workspaceId") != record["workspaceId"]
    ):
        raise WorkspaceError(
            "stale_target",
            "This endpoint now belongs to a different workspace binding.",
        )
    value["verified"] = True
    value["toolCompatible"] = (
        value.get("toolVersion") == TOOL_VERSION and value.get("toolHash") == TOOL_HASH
    )
    value["controlCompatible"] = value.get("controlVersion") == CONTROL_VERSION
    if (
        tools
        and not value["toolCompatible"]
        or control
        and not value["controlCompatible"]
    ):
        raise WorkspaceError(
            "incompatible_runtime",
            "Restart this workspace to use the updated connector. Flush and close it manually if control is incompatible.",
            instance=value,
        )
    return value


def public_record(record: dict) -> dict:
    keys = (
        "instanceId",
        "workspaceId",
        "databasePath",
        "name",
        "apiUrl",
        "browserUrl",
        "mcpUrl",
        "mcpEnabled",
        "ownership",
        "profile",
        "executionMode",
        "embeddedAiEnabled",
        "pid",
        "startedAt",
        "toolVersion",
        "controlVersion",
    )
    return {key: record[key] for key in keys if key in record}
