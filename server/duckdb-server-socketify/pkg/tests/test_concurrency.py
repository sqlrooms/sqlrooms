import asyncio
import json
import os
import tempfile
import time
import subprocess
import sys
import socket

import aiohttp
import pytest


async def send_query(session, port, query, query_id):
    start_time = time.time()
    qid = f"q_{query_id}_{int(start_time*1000)}"
    payload = {
        "type": "arrow",
        "sql": query,
        "queryId": qid,
    }
    try:
        async with session.ws_connect(f'ws://localhost:{port}') as ws:
            await ws.send_str(json.dumps(payload))
            while True:
                msg = await ws.receive()
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                    except Exception:
                        continue
                    if not isinstance(data, dict):
                        continue
                    if data.get("type") == "error" and data.get("queryId") == qid:
                        elapsed = (time.time() - start_time) * 1000
                        return elapsed, False
                elif msg.type == aiohttp.WSMsgType.BINARY:
                    buf = msg.data
                    if len(buf) < 4:
                        continue
                    header_len = int.from_bytes(buf[0:4], byteorder='big')
                    header_start = 4
                    header_end = header_start + header_len
                    if header_end > len(buf):
                        continue
                    try:
                        header = json.loads(buf[header_start:header_end].decode('utf-8'))
                    except Exception:
                        continue
                    if header.get('type') != 'arrow' or header.get('queryId') != qid:
                        continue
                    elapsed = (time.time() - start_time) * 1000
                    return elapsed, True
                elif msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSING):
                    elapsed = (time.time() - start_time) * 1000
                    return elapsed, False
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    elapsed = (time.time() - start_time) * 1000
                    return elapsed, False
    except Exception:
        elapsed = (time.time() - start_time) * 1000
        return elapsed, False


@pytest.fixture(scope="module")
def server_proc():
    temp_db = tempfile.NamedTemporaryFile(suffix='.duckdb', delete=False)
    temp_db.close()
    port = 30012
    out = tempfile.NamedTemporaryFile(delete=False)
    err = tempfile.NamedTemporaryFile(delete=False)
    proc = subprocess.Popen([
        sys.executable, '-m', 'pkg',
        '--db-path', temp_db.name,
        '--port', str(port)
    ], stdout=out, stderr=err)
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
            with open(out.name, 'r') as fo:
                print('STDOUT:', fo.read())
            with open(err.name, 'r') as fe:
                print('STDERR:', fe.read())
        except Exception:
            pass
        pytest.fail("Server failed to start listening on port")
    yield {
        'proc': proc,
        'port': port,
        'db': temp_db.name,
    }
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
    if os.path.exists(temp_db.name):
        os.unlink(temp_db.name)
    try:
        os.unlink(out.name)
    except Exception:
        pass
    try:
        os.unlink(err.name)
    except Exception:
        pass


@pytest.mark.asyncio
async def test_concurrency(server_proc):
    port = server_proc['port']
    queries = [
        "SELECT COUNT(*) FROM generate_series(1, 1000000)",
        "SELECT SUM(x) FROM generate_series(1, 1000000) as t(x)",
        "SELECT AVG(x::float) FROM generate_series(1, 1000000) as t(x)",
        "SELECT MAX(x) FROM generate_series(1, 1000000) as t(x)",
        "SELECT MIN(x) FROM generate_series(1, 1000000) as t(x)",
    ]
    async with aiohttp.ClientSession() as session:
        start_time = time.time()
        tasks = [send_query(session, port, q, i+1) for i, q in enumerate(queries)]
        results = await asyncio.gather(*tasks)
        total_time = (time.time() - start_time) * 1000
        response_times = [r[0] for r in results]
        successful = [r[1] for r in results]
        assert all(successful)
        max_individual = max(response_times)
        concurrency_ratio = max_individual / total_time if total_time > 0 else 0
        # Expect decent concurrency
        assert concurrency_ratio > 0.7
