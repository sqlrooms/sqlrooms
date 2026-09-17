import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from typer.testing import CliRunner

from sqlrooms.cli import app
from sqlrooms.web.claude import claude_arguments, run_claude_session, wait_for_workspace


def fake_server(ready=False):
    status = {
        "status": "ready" if ready else "waiting",
        "enabled": True,
        "bridge": {"status": "ready" if ready else "waiting"},
    }
    return SimpleNamespace(
        _mcp_status=lambda: status,
        _duckdb_start_error=None,
        session_token="private-session-token",
        _mcp_url=lambda: "http://127.0.0.1:42100/mcp",
    )


def test_connection_config_contains_only_environment_references():
    plugin = Path(__file__).parents[3] / "apps/sqlrooms-cli-ui/claude-plugin"
    # tests/ -> sqlrooms/ -> python/ -> repository
    config = json.loads((plugin / "mcp.json").read_text())
    assert (
        config["mcpServers"]["sqlrooms"]["headers"]["Authorization"]
        == "Bearer ${SQLROOMS_MCP_TOKEN}"
    )
    args = claude_arguments(plugin)
    assert "--print" not in args
    assert "--model" not in args
    assert "--permission-mode" not in args
    assert "--strict-mcp-config" in args
    assert "private-session-token" not in str(args)


@pytest.mark.asyncio
async def test_readiness_waits_for_browser_and_fails_on_timeout_or_backend_error():
    server = fake_server()
    with pytest.raises(RuntimeError, match="Timed out"):
        await wait_for_workspace(server, timeout=0.01)
    server._duckdb_start_error = RuntimeError("broken")
    with pytest.raises(RuntimeError, match="database failed"):
        await wait_for_workspace(server)
    await wait_for_workspace(fake_server(True))


@pytest.mark.asyncio
async def test_session_inherits_terminal_auth_and_model_and_keeps_token_out_of_arguments(
    monkeypatch,
):
    monkeypatch.setenv("ANTHROPIC_MODEL", "users-model")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "users-auth")
    child = SimpleNamespace(wait=AsyncMock(return_value=7), returncode=7)
    spawn = AsyncMock(return_value=child)
    monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
    assert await run_claude_session(fake_server(True), "claude", Path("/plugin")) == 7
    args, kwargs = spawn.call_args
    assert "private-session-token" not in str(args)
    assert kwargs["env"]["SQLROOMS_MCP_TOKEN"] == "private-session-token"
    assert kwargs["env"]["ANTHROPIC_MODEL"] == "users-model"
    assert kwargs["env"]["ANTHROPIC_API_KEY"] == "users-auth"
    assert not any(
        key in kwargs for key in ("stdin", "stdout", "stderr", "start_new_session")
    )


@pytest.mark.asyncio
async def test_cancellation_before_readiness_never_launches_claude(monkeypatch):
    spawn = AsyncMock()
    monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
    task = asyncio.create_task(
        run_claude_session(fake_server(), "claude", Path("/plugin"))
    )
    await asyncio.sleep(0)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    spawn.assert_not_called()


@pytest.mark.asyncio
async def test_cancellation_reaps_only_owned_claude_child(monkeypatch):
    exited = asyncio.Event()

    class Child:
        returncode = None
        terminated = False

        async def wait(self):
            await exited.wait()
            return self.returncode

        def terminate(self):
            self.terminated = True
            self.returncode = -15
            exited.set()

    child = Child()
    monkeypatch.setattr(
        asyncio, "create_subprocess_exec", AsyncMock(return_value=child)
    )
    task = asyncio.create_task(
        run_claude_session(fake_server(True), "claude", Path("/plugin"))
    )
    await asyncio.sleep(0.01)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert child.terminated
    assert child.returncode == -15


def test_external_mode_skips_ai_configuration_and_preserves_profile(
    monkeypatch, tmp_path
):
    captured = {}

    class Server:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def start(self):
            pass

    monkeypatch.setattr("sqlrooms.cli.SqlroomsHttpServer", Server)
    monkeypatch.setattr(
        "sqlrooms.cli._load_ai_runtime_config",
        lambda _: pytest.fail("AI config must not load"),
    )
    result = CliRunner().invoke(
        app,
        [
            "--db-path",
            str(tmp_path / "database.duckdb"),
            "--no-config",
            "--execution-mode",
            "external",
            "--profile",
            "document-charts-maps",
        ],
    )
    assert result.exit_code == 0, result.output
    assert captured["execution_mode"] == "external"
    assert captured["capability_profile"] == "document-charts-maps"
    assert captured["ai_providers"] == {}


def test_claude_rejects_missing_database_and_missing_ui(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "sqlrooms.web.claude.claude_prerequisites", lambda: ("claude", Path("/plugin"))
    )
    result = CliRunner().invoke(
        app, ["--claude", "--no-config", str(tmp_path / "missing.duckdb")]
    )
    assert result.exit_code == 1
    assert "existing DuckDB" in result.output
    result = CliRunner().invoke(app, ["--claude", "--no-ui", ":memory:"])
    assert result.exit_code == 1
    assert "requires the browser UI" in result.output


@pytest.mark.asyncio
async def test_readiness_fails_immediately_when_owned_mcp_listener_stops():
    server = fake_server()
    server._mcp_status = lambda: {
        "status": "off",
        "enabled": False,
        "bridge": {"status": "waiting"},
    }
    with pytest.raises(RuntimeError, match="MCP listener stopped"):
        await asyncio.wait_for(wait_for_workspace(server), timeout=0.1)


def test_missing_claude_is_a_clear_prerequisite_error(monkeypatch):
    from sqlrooms.web.claude import claude_prerequisites

    monkeypatch.setattr("sqlrooms.web.claude.shutil.which", lambda _: None)
    with pytest.raises(RuntimeError, match="not installed"):
        claude_prerequisites()


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["session", "http", "http_error", "cancel"])
async def test_runtime_stops_owned_listeners_when_session_or_http_exits(
    monkeypatch, failure
):
    from sqlrooms.web.launcher import SqlroomsHttpServer

    runtime = SqlroomsHttpServer(
        db_path=":memory:",
        host="127.0.0.1",
        port=0,
        ws_port=0,
        serve_ui=False,
        open_browser=False,
    )
    monkeypatch.setattr(runtime, "_start_duckdb_backend", lambda: None)
    stop = AsyncMock()
    close = AsyncMock()
    monkeypatch.setattr(runtime, "_stop_mcp", stop)
    monkeypatch.setattr(runtime.mcp_broker, "close", close)

    class Http:
        should_exit = False

        async def serve(self):
            if failure == "http_error":
                raise RuntimeError("HTTP startup failed")
            if failure == "http":
                await asyncio.sleep(0.01)
                return
            while not self.should_exit:
                await asyncio.sleep(0.01)

    http = Http()
    monkeypatch.setattr("sqlrooms.web.launcher.uvicorn.Server", lambda _: http)
    cancelled = False

    async def session():
        nonlocal cancelled
        if failure == "session":
            raise RuntimeError("session startup failed")
        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            cancelled = True
            raise

    if failure == "session":
        with pytest.raises(RuntimeError, match="session startup failed"):
            await runtime.start(session=session)
    elif failure == "http_error":
        with pytest.raises(RuntimeError, match="HTTP startup failed"):
            await runtime.start(session=session)
        assert cancelled
    elif failure == "cancel":
        # Without a Claude session, parent cancellation also cancels HTTP.
        task = asyncio.create_task(runtime.start())
        await asyncio.sleep(0.01)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    else:
        await runtime.start(session=session)
        assert cancelled
    assert http.should_exit
    stop.assert_awaited_once()
    close.assert_awaited_once()
