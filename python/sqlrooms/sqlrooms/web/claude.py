"""Session-local Claude integration. The browser remains the only workspace."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
import shutil
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .launcher import SqlroomsHttpServer


def claude_prerequisites() -> tuple[str, Path]:
    """Resolve installed resources without modifying Claude configuration."""
    executable = shutil.which("claude")
    if not executable:
        raise RuntimeError(
            "Claude Code is not installed. Install it and run `claude auth login`."
        )
    plugin = Path(__file__).resolve().parents[1] / "claude_plugin"
    if not (plugin / "skills/sqlrooms/SKILL.md").is_file():
        raise RuntimeError(
            "SQLRooms Claude plugin is missing. Rebuild the Python package first."
        )
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise RuntimeError(
            "--claude requires an interactive terminal (stdin and stdout must be TTYs)."
        )
    return executable, plugin


def claude_arguments(plugin: Path) -> list[str]:
    """Load native guidance and env-based MCP configuration for this session only."""
    return [
        "--plugin-dir",
        str(plugin),
        "--strict-mcp-config",
        "--mcp-config",
        str(plugin / "mcp.json"),
        "--append-system-prompt",
        "Use the sqlrooms:sqlrooms skill for SQLRooms work. The connected browser is the authoritative workspace. Query approval happens in that browser. If the browser disconnects, report the failure and wait for it to reconnect before further operations.",
    ]


async def wait_for_workspace(server: SqlroomsHttpServer, timeout: float = 90) -> None:
    """Wait for authenticated browser readiness, not just a listening HTTP socket."""
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        status = server._mcp_status()
        if status["status"] == "error" or not status["enabled"]:
            raise RuntimeError(
                "SQLRooms MCP listener stopped or failed before the browser became ready."
            )
        if server._duckdb_start_error:
            raise RuntimeError("SQLRooms database failed to start.")
        if status["enabled"] and status["bridge"]["status"] == "ready":
            return
        await asyncio.sleep(0.1)
    raise RuntimeError(
        "Timed out waiting for the SQLRooms browser workspace. Open the printed UI URL and retry."
    )


async def run_claude_session(
    server: SqlroomsHttpServer, executable: str, plugin: Path
) -> int:
    """Run a real foreground terminal session and reap only the child we own."""
    print("Waiting for the SQLRooms browser workspace…", file=sys.stderr)
    await wait_for_workspace(server)
    child = await asyncio.create_subprocess_exec(
        executable,
        *claude_arguments(plugin),
        env={
            **os.environ,
            "SQLROOMS_MCP_URL": server._mcp_url(),
            "SQLROOMS_MCP_TOKEN": server.session_token,
        },
        # Inherit the foreground terminal and its process group. Detaching makes
        # terminal reads fail or stop with SIGTTIN. Never signal the shared group.
    )
    waiter = asyncio.create_task(child.wait())
    connected = True
    try:
        while not waiter.done():
            done, _ = await asyncio.wait({waiter}, timeout=0.5)
            if done:
                break
            status = server._mcp_status()
            if not status["enabled"] or status["status"] == "error":
                raise RuntimeError(
                    "SQLRooms MCP listener stopped during the Claude session."
                )
            ready = status["bridge"]["status"] == "ready"
            if ready != connected:
                print(
                    "\nSQLRooms browser reconnected."
                    if ready
                    else "\nSQLRooms browser disconnected. Reopen the UI to reconnect; pending operations fail and are not replayed.",
                    file=sys.stderr,
                )
                connected = ready
        return await waiter
    finally:
        if child.returncode is None:
            child.terminate()
            try:
                await asyncio.wait_for(asyncio.shield(waiter), timeout=5)
            except asyncio.TimeoutError:
                child.kill()
        await waiter
