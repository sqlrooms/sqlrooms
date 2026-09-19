"""Detached process startup reservations and bound listener sockets."""

from __future__ import annotations

import errno
import hashlib
import json
import os
from pathlib import Path
import socket

from . import registry
from .storage import WorkspaceError, atomic_json, home, private_dir


def pending_path(database: str) -> Path:
    return private_dir(home() / "starting") / (
        hashlib.sha256(database.encode()).hexdigest() + ".json"
    )


def check_pending(database: str):
    path = pending_path(database)
    try:
        value = json.loads(path.read_text())
    except FileNotFoundError:
        return
    marker = registry.process_marker(value["pid"])
    if marker is None or value["processMarker"] is None:
        try:
            os.kill(value["pid"], 0)
        except ProcessLookupError:
            path.unlink(missing_ok=True)
            return
        except PermissionError:
            pass
        raise WorkspaceError(
            "startup_unknown",
            "The earlier launcher may still be running, but its identity could not be verified. Check agent status before retrying.",
        )
    if marker == value["processMarker"]:
        raise WorkspaceError(
            "startup_pending",
            "An earlier launch is still starting. List workspaces before retrying; no duplicate was launched.",
            workspaceId=value["workspaceId"],
        )
    path.unlink(missing_ok=True)


def mark_pending(database: str, pid: int, workspace_id: str):
    atomic_json(
        pending_path(database),
        {
            "pid": pid,
            "processMarker": registry.process_marker(pid),
            "workspaceId": workspace_id,
        },
    )


def reserve_listener(host: str, port: int):
    """Bind before publication; keep the socket through uvicorn startup."""
    family = socket.AF_INET6 if ":" in host else socket.AF_INET
    for attempt in range(3):
        sock = socket.socket(family, socket.SOCK_STREAM)
        try:
            sock.bind((host, port if attempt == 0 else 0))
            sock.listen(128)
            sock.setblocking(False)
            return sock
        except OSError as exc:
            sock.close()
            if exc.errno != errno.EADDRINUSE or attempt == 2:
                raise
    raise RuntimeError("Listener allocation failed")


def reserve_managed_listeners(server):
    old_port = server.port
    http = reserve_listener(server.host, old_port)
    try:
        mcp = reserve_listener("127.0.0.1", server.mcp_port)
    except BaseException:
        http.close()
        raise
    server.port = http.getsockname()[1]
    server.mcp_port = mcp.getsockname()[1]
    origins = {
        f"http://{host}:{server.port}" for host in ("127.0.0.1", "localhost", "[::1]")
    }
    server.security.origins.update(origins)
    server.security.hosts.update(origin.removeprefix("http://") for origin in origins)
    server.mcp_security.origins.update(origins)
    server.mcp_security.hosts = {
        f"127.0.0.1:{server.mcp_port}",
        f"localhost:{server.mcp_port}",
    }
    return http, mcp
