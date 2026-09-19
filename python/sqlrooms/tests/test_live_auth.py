"""Real loopback listeners; only an in-memory database and disposable keys."""

import asyncio
import json
import os
import socket
import subprocess
import sys
import time

import aiohttp
import pytest


@pytest.fixture(scope="module")
def live_runtime(tmp_path_factory):
    directory = tmp_path_factory.mktemp("auth-listeners")
    ports = []
    for _ in range(3):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            ports.append(sock.getsockname()[1])
    script = directory / "runtime.py"
    script.write_text("""
import asyncio, json, os
from pathlib import Path
from sqlrooms.web.launcher import SqlroomsHttpServer
from sqlrooms.server import db_async
from sqlrooms.server.cache import QueryCache
from sqlrooms.server.server import server
root = Path(os.environ["AUTH_TEST_DIRECTORY"])
http_port, ws_port, mcp_port = json.loads(os.environ["AUTH_TEST_PORTS"])
runtime = SqlroomsHttpServer(":memory:", "127.0.0.1", http_port, ws_port, mcp_port=mcp_port, serve_ui=False, open_browser=False, mcp_enabled=True, capability_profile="experimental", sync_enabled=True)
runtime.access.page_ttl = 8
# Exercise the production server startup while avoiding extension downloads.
original_init = db_async.init_global_connection
def init_without_extensions(database, **kwargs):
    return original_init(database)
db_async.init_global_connection = init_without_extensions
async def ready():
    fd = os.open(root / "record.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as output:
        json.dump({"native": runtime.session_token, "ticket": runtime.access.ticket()}, output)
    await asyncio.Event().wait()
asyncio.run(runtime.start(ready))
""")
    log = open(directory / "runtime.log", "w")
    process = subprocess.Popen(
        [sys.executable, str(script)],
        env={
            **os.environ,
            "AUTH_TEST_DIRECTORY": str(directory),
            "AUTH_TEST_PORTS": json.dumps(ports),
        },
        stdout=log,
        stderr=log,
    )
    try:
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline and not (directory / "record.json").exists():
            if process.poll() is not None:
                pytest.fail(
                    "Disposable runtime exited: "
                    + (directory / "runtime.log").read_text()
                )
            time.sleep(0.05)
        assert (directory / "record.json").exists()
        yield ports, json.loads((directory / "record.json").read_text())
    finally:
        process.terminate()
        try:
            process.wait(10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()


@pytest.mark.asyncio
async def test_real_crdt_proxy_authentication_and_binary_sync(live_runtime):
    import base64
    from loro import LoroDoc, ExportMode

    ports, record = live_runtime
    origin = f"http://127.0.0.1:{ports[0]}"
    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=10)
    ) as session:
        async with session.post(
            origin + "/api/auth/ticket",
            headers={"Authorization": "Bearer " + record["native"]},
        ) as response:
            launch_url = (await response.json())["url"]
        from urllib.parse import urlsplit, parse_qs

        ticket = parse_qs(urlsplit(launch_url).fragment)["sqlrooms-ticket"][0]
        async with session.post(
            origin + "/api/auth/exchange", json={"ticket": ticket}
        ) as response:
            token = (await response.json())["token"]
        async with (
            session.ws_connect(origin + "/ws/duckdb", origin=origin) as first,
            session.ws_connect(origin + "/ws/duckdb", origin=origin) as second,
        ):
            for index, ws in enumerate((first, second)):
                await ws.send_json({"type": "auth", "token": token})
                assert await ws.receive_json() == {"type": "authAck"}
                await ws.send_json(
                    {"type": "crdt-join", "roomId": "live-crdt", "clientId": str(index)}
                )
                assert (await ws.receive_json())["type"] == "crdt-joined"
                snapshot = await ws.receive_json()
                assert snapshot["type"] == "crdt-snapshot"
            doc = LoroDoc()
            doc.import_(base64.b64decode(snapshot["data"]))
            doc.get_map("test").insert("key", "authenticated sync")
            doc.commit()
            await first.send_bytes(doc.export(ExportMode.Snapshot()))
            message = await second.receive()
            assert message.type == aiohttp.WSMsgType.BINARY
            received = LoroDoc()
            received.import_(message.data)
            assert received.get_map("test").get("key").value == "authenticated sync"


@pytest.mark.asyncio
async def test_real_direct_and_proxy_admission_upload_renewal_and_expiry(live_runtime):
    import pyarrow as pa

    ports, record = live_runtime
    origin = f"http://127.0.0.1:{ports[0]}"
    direct = f"ws://127.0.0.1:{ports[1]}"
    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=15)
    ) as session:
        # Direct upgrade rejects browser Origins, even loopback ones.
        with pytest.raises(aiohttp.WSServerHandshakeError):
            await session.ws_connect(direct, origin=origin)
        async with session.ws_connect(direct) as raw:
            await raw.send_bytes(b"\x00\x00\x00\x00unauthorized")
            assert (await raw.receive_json())["error"] == "unauthorized"
        async with session.ws_connect(direct) as raw:
            await raw.send_json({"type": "auth", "token": record["native"]})
            assert (await raw.receive_json()) == {"type": "authAck"}
            await raw.send_json(
                {"type": "json", "sql": "SELECT 42 as answer", "queryId": "native"}
            )
            assert json.loads((await raw.receive_json())["data"])[0]["answer"] == 42
        async with session.post(
            origin + "/api/auth/exchange", json={"ticket": record["ticket"]}
        ) as response:
            assert response.status == 200
            page = await response.json()
        async with (
            session.ws_connect(origin + "/ws/duckdb", origin=origin) as sql,
            session.ws_connect(origin + "/ws/mcp-bridge", origin=origin) as bridge,
            session.ws_connect(direct) as direct_page,
        ):
            await direct_page.send_json({"type": "auth", "token": page["token"]})
            assert await direct_page.receive_json() == {"type": "authAck"}
            await sql.send_json({"type": "auth", "token": page["token"]})
            assert await sql.receive_json() == {"type": "authAck"}
            # This can queue before the upstream handshake; only the result, not
            # the upstream ack or credentials, may be relayed to the browser.
            await sql.send_json(
                {"type": "json", "sql": "SELECT 7 as answer", "queryId": "proxy"}
            )
            result = await sql.receive_json()
            assert result["queryId"] == "proxy"
            assert json.loads(result["data"])[0]["answer"] == 7
            await bridge.send_json(
                {
                    "version": 1,
                    "type": "bridge.authenticate",
                    "pageId": "live",
                    "token": page["token"],
                }
            )
            assert (await bridge.receive_json())["type"] == "bridge.authenticated"
            await bridge.send_json(
                {"version": 1, "type": "bridge.ready", "pageId": "live"}
            )
            # Authenticated binary upload reaches the same gate.
            sink = pa.BufferOutputStream()
            table = pa.table({"value": [10, 20]})
            with pa.ipc.new_stream(sink, table.schema) as writer:
                writer.write_table(table)
            header = json.dumps(
                {"type": "uploadArrow", "tableName": "uploaded", "queryId": "upload"}
            ).encode()
            await sql.send_bytes(
                len(header).to_bytes(4, "big") + header + sink.getvalue().to_pybytes()
            )
            assert (await sql.receive_json())["type"] == "uploadAck"
            await asyncio.sleep(4)
            async with session.post(
                origin + "/api/auth/renew",
                headers={"Authorization": "Bearer " + page["token"]},
            ) as response:
                assert response.status == 200
                renewed = await response.json()
                assert renewed["token"] == page["token"]
            await asyncio.sleep(4.2)  # original expiry passed, both sockets retained
            await sql.send_json({"type": "auth", "token": page["token"]})
            assert await sql.receive_json() == {"type": "authAck"}
            await sql.send_json(
                {
                    "type": "json",
                    "sql": "SELECT SUM(value) AS total FROM uploaded",
                    "queryId": "renewed",
                }
            )
            assert json.loads((await sql.receive_json())["data"])[0]["total"] == 30
            async with session.get(
                origin + "/api/mcp/status",
                headers={"Authorization": "Bearer " + page["token"]},
            ) as response:
                assert (await response.json())["bridge"]["pageId"] == "live"
            # No renewal: both idle sockets must close within one second of expiry.
            assert (await sql.receive(timeout=7)).type in {
                aiohttp.WSMsgType.CLOSE,
                aiohttp.WSMsgType.CLOSED,
            }
            assert (await bridge.receive(timeout=2)).type in {
                aiohttp.WSMsgType.CLOSE,
                aiohttp.WSMsgType.CLOSED,
            }
            assert (await direct_page.receive_json(timeout=2))[
                "error"
            ] == "unauthorized"
            async with session.post(
                origin + "/api/auth/renew",
                headers={"Authorization": "Bearer " + page["token"]},
            ) as response:
                assert response.status == 401
