import asyncio
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import statistics
from pathlib import Path
import aiohttp
import psutil


async def run():
    runs = []
    for iteration in range(3):
        root = Path(tempfile.mkdtemp(prefix="sqlrooms-bench-"))
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        code = """
import asyncio, json, os
from pathlib import Path
from sqlrooms.web.launcher import SqlroomsHttpServer
s=SqlroomsHttpServer(':memory:', '127.0.0.1', PORT, None, serve_ui=False, open_browser=False)
async def ready():
    Path(RECORD).write_text(json.dumps({'token': s.session_token}))
    await asyncio.Event().wait()
asyncio.run(s.start(ready))
""".replace("PORT", str(port)).replace("RECORD", repr(str(root / "record.json")))
        log = open(root / "log", "w")
        started = time.perf_counter()
        proc = subprocess.Popen(
            [sys.executable, "-c", code],
            stdout=log,
            stderr=log,
            env={**os.environ, "SQLROOMS_HOME": str(root / "home")},
        )
        peak = 0

        async def sample():
            nonlocal peak
            while proc.poll() is None:
                try:
                    peak = max(peak, psutil.Process(proc.pid).memory_info().rss)
                except psutil.NoSuchProcess:
                    break
                await asyncio.sleep(0.01)

        sampler = asyncio.create_task(sample())
        try:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            ) as session:
                url = f"http://127.0.0.1:{port}"
                for _ in range(600):
                    if proc.poll() is not None:
                        raise RuntimeError((root / "log").read_text())
                    try:
                        async with session.get(url + "/healthz") as response:
                            if (
                                response.status == 200
                                and (root / "record.json").exists()
                            ):
                                break
                    except aiohttp.ClientError:
                        pass
                    await asyncio.sleep(0.05)
                startup = (time.perf_counter() - started) * 1000
                token = json.loads((root / "record.json").read_text())["token"]
                async with session.ws_connect(
                    url + "/ws/duckdb", compress=15, max_msg_size=128 * 1024**2
                ) as ws:
                    await ws.send_json({"type": "auth", "token": token})
                    await ws.receive_json()

                    async def query(sql, kind="arrow", qid="q"):
                        at = time.perf_counter()
                        await ws.send_json({"type": kind, "sql": sql, "queryId": qid})
                        msg = await ws.receive()
                        return (time.perf_counter() - at) * 1000, len(msg.data)

                    cold = (await query("SELECT sum(i) FROM range(1000000) t(i)"))[0]
                    warm = [
                        (await query("SELECT sum(i) FROM range(1000000) t(i)"))[0]
                        for _ in range(10)
                    ]
                    at = time.perf_counter()
                    for i in range(8):
                        await ws.send_json(
                            {
                                "type": "arrow",
                                "sql": f"SELECT sum(i+{i}) FROM range(1000000) t(i)",
                                "queryId": str(i),
                            }
                        )
                    for i in range(8):
                        await ws.receive()
                    burst = (time.perf_counter() - at) * 1000
                    large, size = await query(
                        "SELECT i, md5(i::varchar) AS value FROM range(1000000) t(i)"
                    )
                    import pyarrow as pa

                    sink = pa.BufferOutputStream()
                    table = pa.table({"value": list(range(1000000))})
                    with pa.ipc.new_stream(sink, table.schema) as writer:
                        writer.write_table(table)
                    header = json.dumps(
                        {"type": "uploadArrow", "tableName": "upload", "queryId": "up"}
                    ).encode()
                    at = time.perf_counter()
                    await ws.send_bytes(
                        len(header).to_bytes(4, "big")
                        + header
                        + sink.getvalue().to_pybytes()
                    )
                    assert (await ws.receive_json())["type"] == "uploadAck"
                    upload = (time.perf_counter() - at) * 1000
                    await ws.send_json(
                        {
                            "type": "arrow",
                            "sql": "SELECT sum(i) FROM range(10000000000) t(i)",
                            "queryId": "long",
                        }
                    )
                    await asyncio.sleep(0.05)
                    at = time.perf_counter()
                    await ws.send_json({"type": "cancel", "queryId": "long"})
                    while True:
                        msg = await ws.receive_json()
                        if msg.get("type") == "cancelAck":
                            break
                    cancel = (time.perf_counter() - at) * 1000
                    at = time.perf_counter()
                    async with session.get(url + "/healthz") as response:
                        assert response.status == 200
                    health = (time.perf_counter() - at) * 1000
                runs.append(
                    dict(
                        startup_ms=startup,
                        cold_ms=cold,
                        warm_median_ms=statistics.median(warm),
                        burst_8_ms=burst,
                        large_ms=large,
                        large_bytes=size,
                        upload_ms=upload,
                        cancel_ack_ms=cancel,
                        health_ms=health,
                        peak_rss_mib=peak / 1024**2,
                    )
                )
        finally:
            proc.terminate()
            try:
                await asyncio.to_thread(proc.wait, timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
            await sampler
            log.close()
    print(
        json.dumps(
            {
                "client": "aiohttp offers permessage-deflate=15 (server may decline); generated 1M rows; 3 process launches",
                "runs": runs,
            },
            indent=2,
        )
    )


asyncio.run(run())
