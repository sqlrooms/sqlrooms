"""Shared authenticated live runtime for the migrated protocol workloads."""

from contextlib import asynccontextmanager
import json
import os
import socket
import subprocess
import sys
import time

import pytest


@pytest.fixture(scope="module")
def server_proc(tmp_path_factory):
    root = tmp_path_factory.mktemp("runtime")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    script = """
import asyncio, json, os
from pathlib import Path
from sqlrooms.web.launcher import SqlroomsHttpServer
s=SqlroomsHttpServer(':memory:', '127.0.0.1', int(os.environ['TEST_PORT']), serve_ui=False, open_browser=False)
s.runtime.extensions=[]
async def ready():
    Path(os.environ['TEST_RECORD']).write_text(json.dumps({'token': s.session_token}))
    await asyncio.Event().wait()
asyncio.run(s.start(ready))
"""
    log = open(root / "runtime.log", "w")
    process = subprocess.Popen(
        [sys.executable, "-c", script],
        stdout=log,
        stderr=log,
        env={
            **os.environ,
            "TEST_PORT": str(port),
            "TEST_RECORD": str(root / "record"),
            "SQLROOMS_AGENT_HOME": str(root / "agent"),
        },
    )
    try:
        for _ in range(300):
            if (root / "record").exists():
                break
            if process.poll() is not None:
                pytest.fail((root / "runtime.log").read_text())
            time.sleep(0.05)
        assert (root / "record").exists(), (root / "runtime.log").read_text()
        yield {
            "proc": process,
            "port": port,
            **json.loads((root / "record").read_text()),
        }
    finally:
        process.terminate()
        try:
            process.wait(10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()


@pytest.fixture(scope="module")
def server_proc_auth(server_proc):
    return server_proc


@asynccontextmanager
async def authenticated_socket(session, port, token):
    async with session.ws_connect(f"ws://localhost:{port}/ws/duckdb") as ws:
        await ws.send_json({"type": "auth", "token": token})
        assert await ws.receive_json() == {"type": "authAck"}
        yield ws
