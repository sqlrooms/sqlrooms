"""Compare slow/disconnected readers, control latency and CRDT on either runtime.

Run using each revision's interpreter. No external data or credentials are used.
"""

import asyncio
import base64
import json
import os
from pathlib import Path
import socket
import statistics
import subprocess
import sys
import tempfile
import time

import aiohttp
import psutil
from loro import LoroDoc, ExportMode


async def measure():
    runs = []
    for iteration in range(3):
        with tempfile.TemporaryDirectory(prefix="sqlrooms-stress-") as directory:
            root = Path(directory)
            with socket.socket() as socket_:
                socket_.bind(("127.0.0.1", 0))
                port = socket_.getsockname()[1]
            code = """
import asyncio,json,os
from pathlib import Path
from sqlrooms.web.launcher import SqlroomsHttpServer
s=SqlroomsHttpServer(':memory:','127.0.0.1',int(os.environ['PORT']),None,serve_ui=False,open_browser=False,capability_profile='experimental',sync_enabled=True)
async def ready():
    Path(os.environ['RECORD']).write_text(json.dumps({'token':s.session_token}))
    await asyncio.Event().wait()
asyncio.run(s.start(ready))
"""
            with open(root / "log", "w") as log:
                process = subprocess.Popen(
                    [sys.executable, "-c", code],
                    stdout=log,
                    stderr=log,
                    env={
                        **os.environ,
                        "PORT": str(port),
                        "RECORD": str(root / "record"),
                        "SQLROOMS_HOME": str(root / "home"),
                    },
                )
                peaks = []
                latencies = []
                stop = False
                url = f"http://127.0.0.1:{port}"
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=45)
                ) as http:
                    try:
                        for _ in range(400):
                            if (root / "record").exists():
                                break
                            if process.poll() is not None:
                                raise RuntimeError((root / "log").read_text())
                            await asyncio.sleep(0.025)
                        token = json.loads((root / "record").read_text())["token"]

                        async def observer():
                            while not stop:
                                at = time.perf_counter()
                                async with http.get(url + "/healthz") as response:
                                    assert response.status == 200
                                latencies.append((time.perf_counter() - at) * 1000)
                                peaks.append(
                                    psutil.Process(process.pid).memory_info().rss
                                    / 1024**2
                                )
                                await asyncio.sleep(0.01)

                        async def connect():
                            ws = await http.ws_connect(
                                url + "/ws/duckdb",
                                compress=15,
                                max_msg_size=128 * 1024**2,
                            )
                            await ws.send_json({"type": "auth", "token": token})
                            assert (await ws.receive_json())["type"] == "authAck"
                            return ws

                        observer_task = asyncio.create_task(observer())
                        # Produce large results for a delayed consumer while control
                        # traffic uses an independent socket and the same API listener.
                        slow = await connect()
                        control = await connect()
                        started = time.perf_counter()
                        for i in range(3):
                            await slow.send_json(
                                {
                                    "type": "arrow",
                                    "sql": "SELECT i, md5(i::varchar) AS text FROM range(1000000) t(i)",
                                    "queryId": str(i),
                                }
                            )
                        await control.send_json(
                            {
                                "type": "json",
                                "sql": "SELECT sum(i) FROM range(10000000000) t(i)",
                                "queryId": "long",
                            }
                        )
                        await asyncio.sleep(0.2)
                        at = time.perf_counter()
                        await control.send_json({"type": "cancel", "queryId": "long"})
                        while (await control.receive_json()).get("type") != "cancelAck":
                            pass
                        cancel = (time.perf_counter() - at) * 1000
                        await asyncio.sleep(0.5)
                        for _ in range(3):
                            message = await slow.receive()
                            assert message.type == aiohttp.WSMsgType.BINARY
                        slow_ms = (time.perf_counter() - started) * 1000
                        await slow.close()
                        await control.close()
                        dropped = await connect()
                        await dropped.send_json(
                            {
                                "type": "arrow",
                                "sql": "SELECT i, md5(i::varchar) FROM range(1000000) t(i)",
                                "queryId": "gone",
                            }
                        )
                        await dropped.close()
                        await asyncio.sleep(0.2)
                        # Slow CRDT subscriber alongside a fast subscriber. Both
                        # must receive the same valid update, with bounded server memory.
                        writer = await connect()
                        fast = await connect()
                        delayed = await connect()
                        for ws in (writer, fast, delayed):
                            await ws.send_json(
                                {"type": "crdt-join", "roomId": "stress"}
                            )
                            assert (await ws.receive_json())["type"] == "crdt-joined"
                            snapshot = await ws.receive_json()
                        doc = LoroDoc()
                        doc.import_(base64.b64decode(snapshot["data"]))
                        doc.get_text("body").insert(0, "0123456789abcdef" * 65536)
                        doc.commit()
                        update = doc.export(ExportMode.Snapshot())
                        at = time.perf_counter()
                        await writer.send_bytes(update)
                        assert (await fast.receive()).type == aiohttp.WSMsgType.BINARY
                        crdt_ms = (time.perf_counter() - at) * 1000
                        await asyncio.sleep(0.25)
                        assert (
                            await delayed.receive()
                        ).type == aiohttp.WSMsgType.BINARY
                        for ws in (writer, fast, delayed):
                            await ws.close()
                        stop = True
                        await observer_task
                        runs.append(
                            dict(
                                slow_three_44mb_ms=slow_ms,
                                cancel_ack_ms=cancel,
                                health_max_ms=max(latencies),
                                health_median_ms=statistics.median(latencies),
                                crdt_fast_ms=crdt_ms,
                                crdt_bytes=len(update),
                                peak_rss_mib=max(peaks),
                            )
                        )
                    finally:
                        stop = True
                        process.terminate()
                        try:
                            await asyncio.to_thread(process.wait, timeout=10)
                        except subprocess.TimeoutExpired:
                            process.kill()
                            process.wait()
    print(
        json.dumps(
            {
                "client": "aiohttp offers permessage-deflate=15 (server may decline); 3 runs; delayed reader 0.5s and CRDT reader 0.25s; concurrent HTTP observer",
                "runs": runs,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(measure())
