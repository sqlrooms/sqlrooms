"""Runtime ownership, persistence and reuse contracts."""

import asyncio
import json
import sys
import threading
from types import SimpleNamespace

import duckdb
import pytest
from fastapi.testclient import TestClient
from starlette.responses import HTMLResponse
from starlette.websockets import WebSocketDisconnect

from sqlrooms.server.access import LocalAccess
from sqlrooms.server.app import create_app, UVICORN_OPTIONS
from sqlrooms.server.runtime import DuckDBRuntime
from sqlrooms.server.security import TransportSecurity


def alternate_app(tmp_path, **kwargs):
    runtime = DuckDBRuntime(
        str(tmp_path / "alternate.duckdb"), tmp_path / "storage", extensions=[]
    )
    access = LocalAccess()
    security = TransportSecurity(access, {"http://testserver"}, {"testserver"})

    def configure(app):
        @app.get("/")
        async def page():
            return HTMLResponse("<title>Alternate analysis app</title>")

    return create_app(
        runtime, security, title="Alternate analysis app", configure=configure, **kwargs
    ), access


def test_alternate_application_has_own_assets_no_sync_and_preserves_database(tmp_path):
    app, access = alternate_app(tmp_path)
    with TestClient(app) as client:
        assert "Alternate analysis app" in client.get("/").text
        assert client.get("/readyz").status_code == 200
        assert app.state.resources.sync is None
        with client.websocket_connect("/ws/duckdb") as ws:
            ws.send_json({"type": "auth", "token": access.native_token})
            assert ws.receive_json() == {"type": "authAck"}
            ws.send_json(
                {
                    "type": "exec",
                    "sql": "CREATE TABLE saved AS SELECT 42 AS value",
                    "queryId": "save",
                }
            )
            assert ws.receive_json() == {"type": "ok", "queryId": "save"}
    assert app.state.resources.runtime.closed
    with duckdb.connect(str(tmp_path / "alternate.duckdb")) as db:
        assert db.execute("SELECT value FROM saved").fetchone() == (42,)


@pytest.mark.asyncio
async def test_instances_are_independent_and_cancellation_is_cursor_scoped(tmp_path):
    first = DuckDBRuntime(":memory:", tmp_path / "a", extensions=[])
    second = DuckDBRuntime(":memory:", tmp_path / "b", extensions=[])
    await first.start()
    await second.start()
    try:
        long = asyncio.create_task(
            first.run_db_task(
                lambda c: c.execute(
                    "SELECT sum(i) FROM range(100000000000) t(i)"
                ).fetchone(),
                query_id="long",
            )
        )
        await asyncio.sleep(0.03)
        assert await second.run_db_task(
            lambda c: c.execute("SELECT 42").fetchone()
        ) == (42,)
        assert await first.run_db_task(lambda c: c.execute("SELECT 7").fetchone()) == (
            7,
        )
        assert first.cancel_query("long")
        with pytest.raises(duckdb.InterruptException):
            await long
        assert not first.operations
        await first.close()
        assert await second.run_db_task(lambda c: c.execute("SELECT 9").fetchone()) == (
            9,
        )
    finally:
        await first.close()
        await second.close()


@pytest.mark.asyncio
async def test_runtime_admission_is_bounded_and_disconnect_settles_worker(tmp_path):
    runtime = DuckDBRuntime(":memory:", tmp_path, extensions=[], max_operations=1)
    await runtime.start()
    entered, release = threading.Event(), threading.Event()

    def work(cursor):
        entered.set()
        release.wait(5)
        return 1

    task = asyncio.create_task(runtime.run_db_task(work, query_id="held"))
    await asyncio.to_thread(entered.wait, 2)
    with pytest.raises(RuntimeError, match="busy"):
        await runtime.run_db_task(lambda c: 2)
    task.cancel()
    await asyncio.sleep(0.01)
    assert "held" in runtime.operations  # asyncio cancellation is not worker completion
    task.cancel()  # Repeated disconnect/cancel must not unregister a live worker.
    with pytest.raises(asyncio.CancelledError):
        await task
    assert "held" in runtime.operations
    close = asyncio.create_task(runtime.close())
    await asyncio.sleep(0.01)
    assert not close.done()
    release.set()
    await asyncio.wait_for(close, 2)
    assert not runtime.operations
    await runtime.close()
    await runtime.close()


@pytest.mark.asyncio
async def test_cancelled_close_keeps_worker_registered_and_retry_joins_shutdown(
    tmp_path,
):
    runtime = DuckDBRuntime(":memory:", tmp_path, extensions=[])
    await runtime.start()
    entered, release = threading.Event(), threading.Event()

    def work(cursor):
        entered.set()
        release.wait(5)
        return 1

    worker = asyncio.create_task(runtime.run_db_task(work, query_id="held"))
    await asyncio.wait_for(asyncio.to_thread(entered.wait, 2), 3)
    first_close = asyncio.create_task(runtime.close())
    await asyncio.sleep(0.02)
    first_close.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first_close
    assert "held" in runtime.operations
    assert not runtime.closed

    retry = asyncio.create_task(runtime.close())
    abort = asyncio.create_task(runtime.abort())
    await asyncio.sleep(0.02)
    assert not retry.done() and not abort.done()
    assert "held" in runtime.operations

    release.set()
    assert await asyncio.wait_for(worker, 3) == 1
    await asyncio.wait_for(asyncio.gather(retry, abort), 3)
    assert runtime.closed and runtime._persisted
    assert not runtime.operations


@pytest.mark.asyncio
async def test_checkpoint_failure_never_becomes_successful_close(tmp_path):
    runtime = DuckDBRuntime(":memory:", tmp_path, extensions=[])
    await runtime.start()
    real = runtime.connection

    def fail(_):
        raise OSError("checkpoint failed")

    runtime.connection = SimpleNamespace(execute=fail)
    with pytest.raises(OSError, match="checkpoint failed"):
        await runtime.close()
    assert not runtime.closed
    assert not runtime.ready
    runtime.connection = real
    await runtime.close()


@pytest.mark.asyncio
async def test_partial_startup_releases_connection_and_executor(tmp_path):
    runtime = DuckDBRuntime(":memory:", tmp_path, extensions=[], meta_namespace="")
    app = create_app(runtime, TransportSecurity(LocalAccess(), set(), set()))
    with pytest.raises(ValueError, match="namespace"):
        async with app.router.lifespan_context(app):
            pytest.fail("startup must fail")
    assert runtime.connection is None
    assert runtime.closed


@pytest.mark.asyncio
@pytest.mark.parametrize("shutdown_method", ["close", "abort"])
async def test_cancelled_startup_is_not_ready_and_shutdown_waits_for_initializer(
    tmp_path, monkeypatch, shutdown_method
):
    entered, release = threading.Event(), threading.Event()
    real_connect = duckdb.connect

    def delayed_connect(*args, **kwargs):
        entered.set()
        if not release.wait(5):
            raise TimeoutError("initializer was not released")
        return real_connect(*args, **kwargs)

    monkeypatch.setattr(duckdb, "connect", delayed_connect)
    runtime = DuckDBRuntime(":memory:", tmp_path, extensions=[])
    startup = asyncio.create_task(runtime.start())
    await asyncio.wait_for(asyncio.to_thread(entered.wait, 2), 3)
    assert not runtime.ready
    with pytest.raises(RuntimeError, match="started twice"):
        await runtime.start()
    startup.cancel()
    with pytest.raises(asyncio.CancelledError):
        await startup
    close = asyncio.create_task(getattr(runtime, shutdown_method)())
    await asyncio.sleep(0.02)
    assert not close.done()
    assert not runtime.ready
    release.set()
    await asyncio.wait_for(close, 3)
    assert runtime.closed and runtime.connection is None


def test_two_callers_cannot_cancel_each_others_same_query_id(tmp_path):
    app, access = alternate_app(tmp_path)
    with TestClient(app) as client:
        with (
            client.websocket_connect("/ws/duckdb") as first,
            client.websocket_connect("/ws/duckdb") as second,
        ):
            for ws in (first, second):
                ws.send_json({"type": "auth", "token": access.native_token})
                assert ws.receive_json()["type"] == "authAck"
            first.send_json(
                {
                    "type": "json",
                    "sql": "SELECT sum(i) FROM range(100000000000) t(i)",
                    "queryId": "same",
                }
            )
            second.send_json({"type": "cancel", "queryId": "same"})
            assert second.receive_json() == {
                "type": "cancelAck",
                "queryId": "same",
                "cancelled": False,
            }
            second.send_json(
                {"type": "json", "sql": "SELECT 42 AS value", "queryId": "same"}
            )
            assert json.loads(second.receive_json()["data"]) == [{"value": 42}]
            first.send_json({"type": "cancel", "queryId": "same"})
            outcomes = [first.receive_json(), first.receive_json()]
            assert {item["type"] for item in outcomes} == {"cancelAck", "error"}
            assert client.get("/healthz").status_code == 200


@pytest.mark.parametrize(
    "message",
    [
        b"not authenticated",
        {"type": "auth", "token": "wrong"},
        {"type": "subscribe", "channel": "private"},
    ],
)
def test_alternate_app_never_dispatches_before_auth(tmp_path, message):
    app, _ = alternate_app(tmp_path)
    with TestClient(app) as client:
        with client.websocket_connect("/ws/duckdb") as ws:
            if isinstance(message, bytes):
                ws.send_bytes(message)
            else:
                ws.send_json(message)
            with pytest.raises(WebSocketDisconnect) as error:
                ws.receive_json()
            assert error.value.code == 1008


def test_sync_persists_and_reopens(tmp_path):
    import base64
    from loro import LoroDoc, ExportMode

    for iteration in range(2):
        app, access = alternate_app(tmp_path, sync_enabled=True)
        with TestClient(app) as client:
            with client.websocket_connect("/ws/duckdb") as ws:
                ws.send_json({"type": "auth", "token": access.native_token})
                ws.receive_json()
                ws.send_json({"type": "crdt-join", "roomId": "saved"})
                ws.receive_json()
                doc = LoroDoc()
                doc.import_(base64.b64decode(ws.receive_json()["data"]))
                if iteration == 0:
                    doc.get_map("test").insert("value", "persisted")
                    doc.commit()
                    ws.send_bytes(doc.export(ExportMode.Snapshot()))
                    assert isinstance(ws.receive_bytes(), bytes)
                    assert ws.receive_json()["type"] == "crdt-update-ack"
                else:
                    assert doc.get_map("test").get("value").value == "persisted"


def test_explicit_transport_configuration():
    assert UVICORN_OPTIONS["workers"] == 1
    assert UVICORN_OPTIONS["ws_max_size"] == 128 * 1024 * 1024
    assert UVICORN_OPTIONS["ws_per_message_deflate"] is False
    assert UVICORN_OPTIONS["ws_ping_interval"] == 20
    assert UVICORN_OPTIONS["ws_ping_timeout"] == 20


def test_runtime_imports_no_ui_cli_or_sync():
    import subprocess

    subprocess.run(
        [
            sys.executable,
            "-c",
            "from sqlrooms.server.app import create_app; import sys; assert not any(k.startswith(('sqlrooms.web', 'sqlrooms.cli', 'sqlrooms.server.crdt', 'loro')) for k in sys.modules)",
        ],
        check=True,
    )


def test_switching_sync_rooms_detaches_previous_subscription(tmp_path):
    app, access = alternate_app(tmp_path, sync_enabled=True)
    with TestClient(app) as client:
        with client.websocket_connect("/ws/duckdb") as ws:
            ws.send_json({"type": "auth", "token": access.native_token})
            ws.receive_json()
            for room in ("first", "second"):
                ws.send_json({"type": "crdt-join", "roomId": room})
                assert ws.receive_json() == {"type": "crdt-joined", "roomId": room}
                assert ws.receive_json()["type"] == "crdt-snapshot"
            connection = next(iter(app.state.resources.transport.connections))
            assert "first" not in connection.channels
            assert "second" in connection.channels
