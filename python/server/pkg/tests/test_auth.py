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
def server_proc_auth():
    port = 30021
    token = "secret123"
    out = tempfile.NamedTemporaryFile(delete=False)
    err = tempfile.NamedTemporaryFile(delete=False)
    env = os.environ.copy()
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "pkg",
            "--port",
            str(port),
            "--auth-token",
            token,
        ],
        stdout=out,
        stderr=err,
        env=env,
    )
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
        "token": token,
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
async def test_ws_auth_flow(server_proc_auth):
    port = server_proc_auth["port"]
    token = server_proc_auth["token"]
    timeout = aiohttp.ClientTimeout(total=5)

    # Unauthorized attempt: send query without first auth -> expect error/close
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            await ws.send_str(
                json.dumps(
                    {
                        "type": "json",
                        "sql": "select 1 as x",
                        "queryId": "unauth1",
                    }
                )
            )
            # Expect either an error then close, or immediate close
            got_unauth = False
            for _ in range(10):
                msg = await ws.receive()
                if msg.type == aiohttp.WSMsgType.TEXT:
                    print("[UNAUTH TEXT]", msg.data)
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if (
                        payload.get("type") == "error"
                        and "unauthorized" in str(payload.get("error", "")).lower()
                    ):
                        got_unauth = True
                        break
                elif msg.type in (
                    aiohttp.WSMsgType.CLOSE,
                    aiohttp.WSMsgType.CLOSED,
                    aiohttp.WSMsgType.CLOSING,
                    aiohttp.WSMsgType.ERROR,
                ):
                    # Consider this as unauthorized flow handled
                    got_unauth = True
                    break
            assert got_unauth

    # Authorized flow: send auth, expect ack, then a successful query
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            await ws.send_str(json.dumps({"type": "auth", "token": token}))
            # Expect authAck
            auth_debug = []
            for _ in range(20):
                msg = await ws.receive()
                if msg.type != aiohttp.WSMsgType.TEXT:
                    continue
                try:
                    payload = json.loads(msg.data)
                except Exception:
                    auth_debug.append(f"NON-JSON TEXT: {msg.data}")
                    continue
                auth_debug.append(f"TEXT: {json.dumps(payload)}")
                if payload.get("type") == "authAck":
                    break
            else:
                print("[AUTH DEBUG]", "\n".join(auth_debug))
                pytest.fail("Did not receive authAck")

            # Now send a normal query and expect a JSON response with data
            qid = "auth_ok_1"
            await ws.send_str(
                json.dumps({"type": "json", "sql": "select 1 as x", "queryId": qid})
            )
            got_result = False
            query_debug = []
            for _ in range(200):
                msg = await ws.receive()
                if msg.type == aiohttp.WSMsgType.TEXT:
                    print("[POST-AUTH TEXT]", msg.data)
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        query_debug.append(f"NON-JSON TEXT: {msg.data}")
                        continue
                    query_debug.append(f"TEXT: {json.dumps(payload)}")
                    if payload.get("queryId") == qid and payload.get("type") == "json":
                        arr = json.loads(payload.get("data", "[]"))
                        assert isinstance(arr, list) and len(arr) == 1
                        assert "x" in arr[0]
                        got_result = True
                        break
                elif msg.type == aiohttp.WSMsgType.BINARY:
                    buf = msg.data
                    if len(buf) >= 4:
                        hlen = int.from_bytes(buf[0:4], byteorder="big")
                        if 4 + hlen <= len(buf):
                            try:
                                header = json.loads(buf[4 : 4 + hlen].decode("utf-8"))
                                query_debug.append(
                                    f"BINARY HEADER: {json.dumps(header)}"
                                )
                                if header.get("queryId") == qid:
                                    # Accept arrow result as success too
                                    got_result = True
                                    break
                            except Exception:
                                query_debug.append("BINARY HEADER PARSE ERROR")
                                pass
                elif msg.type in (
                    aiohttp.WSMsgType.CLOSE,
                    aiohttp.WSMsgType.CLOSED,
                    aiohttp.WSMsgType.CLOSING,
                    aiohttp.WSMsgType.ERROR,
                ):
                    query_debug.append(f"EVENT: {msg.type}")
                    break
            if not got_result:
                print("[QUERY DEBUG]", "\n".join(query_debug))
            assert got_result
