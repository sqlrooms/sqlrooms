import json
import os
import tempfile
import time
import subprocess
import sys
import socket

import aiohttp
import pytest


@pytest.fixture(scope="module")
def server_proc():
    port = 30011
    out = tempfile.NamedTemporaryFile(delete=False)
    err = tempfile.NamedTemporaryFile(delete=False)
    proc = subprocess.Popen(
        [sys.executable, "-m", "pkg", "--port", str(port)], stdout=out, stderr=err
    )
    # Wait until port is accepting connections or timeout
    started = False
    deadline = time.time() + 12.0
    while time.time() < deadline:
        if proc.poll() is not None:
            break
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                started = True
                break
        except OSError:
            time.sleep(0.1)
    if not started:
        try:
            proc.terminate()
        except Exception:
            pass
        try:
            with open(out.name, "r") as fo:
                print("STDOUT:", fo.read())
            with open(err.name, "r") as fe:
                print("STDERR:", fe.read())
        except Exception:
            pass
        pytest.fail("Server failed to start listening on port")
    yield {
        "proc": proc,
        "port": port,
    }
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
    try:
        os.unlink(out.name)
    except Exception:
        pass
    try:
        os.unlink(err.name)
    except Exception:
        pass


@pytest.mark.asyncio
async def test_ws_query_and_correlation(server_proc):
    port = server_proc["port"]
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            qid = "q1"
            await ws.send_str(
                json.dumps(
                    {
                        "type": "arrow",
                        "sql": "select 1 as x",
                        "queryId": qid,
                    }
                )
            )
            # Expect a binary frame with 4B length + header JSON containing queryId
            msg = await ws.receive()
            assert msg.type == aiohttp.WSMsgType.BINARY
            data = msg.data
            assert len(data) >= 4
            hlen = int.from_bytes(data[0:4], byteorder="big")
            header = json.loads(data[4 : 4 + hlen].decode("utf-8"))
            assert header["type"] == "arrow"
            assert header["queryId"] == qid


@pytest.mark.asyncio
async def test_ws_cancel(server_proc):
    port = server_proc["port"]
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            qid = "long_q"
            # Start a long-running query
            await ws.send_str(
                json.dumps(
                    {
                        "type": "json",
                        "sql": "select sum(x) as s from generate_series(1, 30000000) t(x)",
                        "queryId": qid,
                    }
                )
            )
            # Immediately send cancel
            await ws.send_str(
                json.dumps(
                    {
                        "type": "cancel",
                        "queryId": qid,
                    }
                )
            )
            # Accept either a cancel error, or a successful json/ok with matching queryId
            for _ in range(50):
                msg = await ws.receive()
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if not isinstance(payload, dict):
                        continue
                    if payload.get("queryId") == qid:
                        t = payload.get("type")
                        if t == "error":
                            assert "cancel" in payload.get("error", "").lower()
                            break
                        if t in ("json", "ok"):
                            break
            else:
                pytest.fail("Did not observe outcome for cancelled query")


@pytest.mark.asyncio
async def test_ws_subscribe_notify(server_proc):
    port = server_proc["port"]
    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            await ws.send_str(
                json.dumps({"type": "subscribe", "channel": "table:orders"})
            )
            # ack
            msg = await ws.receive()
            assert msg.type == aiohttp.WSMsgType.TEXT
            ack = json.loads(msg.data)
            assert ack.get("type") == "subscribed"
            assert ack.get("channel") == "table:orders"

            # publish
            await ws.send_str(
                json.dumps(
                    {
                        "type": "notify",
                        "channel": "table:orders",
                        "payload": {"op": "update"},
                    }
                )
            )
            # Expect immediate echo notify to sender
            for _ in range(20):
                msg = await ws.receive()
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if (
                        payload.get("type") == "notify"
                        and payload.get("channel") == "table:orders"
                    ):
                        assert payload.get("payload", {}).get("op") == "update"
                        break
            else:
                pytest.fail("Did not receive published notify")
