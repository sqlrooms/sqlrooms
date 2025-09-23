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
    qid = f"q_{query_id}_{int(start_time * 1000)}"
    payload = {
        "type": "arrow",
        "sql": query,
        "queryId": qid,
    }
    try:
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
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
                    header_len = int.from_bytes(buf[0:4], byteorder="big")
                    header_start = 4
                    header_end = header_start + header_len
                    if header_end > len(buf):
                        continue
                    try:
                        header = json.loads(
                            buf[header_start:header_end].decode("utf-8")
                        )
                    except Exception:
                        continue
                    if header.get("type") != "arrow" or header.get("queryId") != qid:
                        continue
                    elapsed = (time.time() - start_time) * 1000
                    return elapsed, True
                elif msg.type in (
                    aiohttp.WSMsgType.CLOSE,
                    aiohttp.WSMsgType.CLOSED,
                    aiohttp.WSMsgType.CLOSING,
                ):
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
    port = 30012
    out = tempfile.NamedTemporaryFile(delete=False)
    err = tempfile.NamedTemporaryFile(delete=False)
    proc = subprocess.Popen(
        [sys.executable, "-m", "pkg", "--port", str(port)], stdout=out, stderr=err
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
async def test_concurrency(server_proc):
    port = server_proc["port"]
    queries = [
        "SELECT COUNT(*) FROM generate_series(1, 1000000)",
        "SELECT SUM(x) FROM generate_series(1, 1000000) as t(x)",
        "SELECT AVG(x::float) FROM generate_series(1, 1000000) as t(x)",
        "SELECT MAX(x) FROM generate_series(1, 1000000) as t(x)",
        "SELECT MIN(x) FROM generate_series(1, 1000000) as t(x)",
    ]
    async with aiohttp.ClientSession() as session:
        start_time = time.time()
        tasks = [send_query(session, port, q, i + 1) for i, q in enumerate(queries)]
        results = await asyncio.gather(*tasks)
        total_time = (time.time() - start_time) * 1000
        response_times = [r[0] for r in results]
        successful = [r[1] for r in results]
        assert all(successful)
        max_individual = max(response_times)
        concurrency_ratio = max_individual / total_time if total_time > 0 else 0
        # Expect decent concurrency
        assert concurrency_ratio > 0.7


@pytest.mark.asyncio
async def test_concurrent_writes(server_proc):
    port = server_proc["port"]
    table = "t_concurrent"
    async with aiohttp.ClientSession() as session:
        # Setup table
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            for sql in [
                f"DROP TABLE IF EXISTS {table}",
                f"CREATE TABLE {table}(x INT)",
            ]:
                qid = f"setup_{int(time.time() * 1000)}"
                await ws.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                # wait for ok/error
                for _ in range(20):
                    msg = await ws.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        assert payload.get("type") in ("ok", "error")
                        if payload.get("type") == "error":
                            pytest.fail(f"setup failed: {payload.get('error')}")
                        break

        # Concurrent inserts across disjoint ranges
        async def do_insert(a: int, b: int, idx: int):
            qid = f"ins_{idx}_{int(time.time() * 1000)}"
            sql = f"INSERT INTO {table} SELECT x FROM generate_series({a}, {b}) AS t(x)"
            async with session.ws_connect(f"ws://localhost:{port}") as ws2:
                await ws2.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                for _ in range(200):
                    msg = await ws2.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        if payload.get("type") == "error":
                            return False
                        return True
            return False

        ranges = [
            (1, 20000),
            (20001, 40000),
            (40001, 60000),
            (60001, 80000),
            (80001, 100000),
        ]
        results = await asyncio.gather(
            *(do_insert(a, b, i) for i, (a, b) in enumerate(ranges))
        )
        assert all(results)

        # Verify row count
        qid = f"chk_{int(time.time() * 1000)}"
        sql = f"SELECT COUNT(*) AS n FROM {table}"
        async with session.ws_connect(f"ws://localhost:{port}") as ws3:
            await ws3.send_str(json.dumps({"type": "json", "sql": sql, "queryId": qid}))
            for _ in range(200):
                msg = await ws3.receive()
                if msg.type != aiohttp.WSMsgType.TEXT:
                    continue
                try:
                    payload = json.loads(msg.data)
                except Exception:
                    continue
                if payload.get("queryId") == qid and payload.get("type") == "json":
                    data_json = payload.get("data")
                    try:
                        arr = json.loads(data_json)
                    except Exception:
                        pytest.fail("invalid json payload")
                    assert isinstance(arr, list) and len(arr) == 1
                    expected = sum(b - a + 1 for a, b in ranges)
                    assert arr[0].get("n") == expected
                    break
            else:
                pytest.fail("did not receive count json response")


@pytest.mark.asyncio
async def test_concurrent_ctas_long_ops(server_proc):
    """
    Concurrently create multiple tables using CTAS (CREATE TABLE AS SELECT)
    where the SELECT side performs a more expensive operation (generate_series
    over a large range). This validates that:
      - write workloads run in parallel without blocking each other excessively
      - catalog operations for different tables do not conflict
      - server returns "ok" for exec messages and the results are visible
    """
    port = server_proc["port"]
    tables = [f"t_ctas_{i}" for i in range(5)]
    ranges = [(1, 50000), (1, 60000), (1, 70000), (1, 80000), (1, 90000)]

    async with aiohttp.ClientSession() as session:
        # Drop pre-existing tables if present
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            for t in tables:
                qid = f"drop_{t}_{int(time.time() * 1000)}"
                await ws.send_str(
                    json.dumps(
                        {
                            "type": "exec",
                            "sql": f"DROP TABLE IF EXISTS {t}",
                            "queryId": qid,
                        }
                    )
                )
                # Wait for ack
                for _ in range(50):
                    msg = await ws.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        break

        # Helper to CTAS with a heavy generate_series
        async def do_ctas(t: str, a: int, b: int):
            qid = f"ctas_{t}_{int(time.time() * 1000)}"
            sql = f"CREATE TABLE {t} AS SELECT x FROM generate_series({a}, {b}) AS t(x)"
            async with session.ws_connect(f"ws://localhost:{port}") as ws2:
                await ws2.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                for _ in range(400):
                    msg = await ws2.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        return payload.get("type") == "ok"
            return False

        # Launch CTAS concurrently
        results = await asyncio.gather(
            *(do_ctas(t, a, b) for t, (a, b) in zip(tables, ranges))
        )
        assert all(results)

        # Verify each table has expected number of rows
        async with session.ws_connect(f"ws://localhost:{port}") as ws3:
            for t, (a, b) in zip(tables, ranges):
                qid = f"count_{t}_{int(time.time() * 1000)}"
                await ws3.send_str(
                    json.dumps(
                        {
                            "type": "json",
                            "sql": f"SELECT COUNT(*) AS n FROM {t}",
                            "queryId": qid,
                        }
                    )
                )
                for _ in range(200):
                    msg = await ws3.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid and payload.get("type") == "json":
                        arr = json.loads(payload.get("data", "[]"))
                        assert isinstance(arr, list) and len(arr) == 1
                        expected = b - a + 1
                        assert arr[0].get("n") == expected
                        break
                else:
                    pytest.fail(f"did not receive count for {t}")


@pytest.mark.asyncio
async def test_mixed_workload(server_proc):
    """
    Mixed workload: concurrent reads, inserts, and CTAS.
    Validates the server can handle parallel heterogeneous operations
    without starving reads or causing catalog conflicts.
    """
    port = server_proc["port"]
    table = "t_mixed"
    async with aiohttp.ClientSession() as session:
        # Prepare base table
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            for sql in [
                f"DROP TABLE IF EXISTS {table}",
                f"CREATE TABLE {table}(x INT)",
                f"INSERT INTO {table} VALUES (1),(2),(3)",
            ]:
                qid = f"setup_{int(time.time() * 1000)}"
                await ws.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                for _ in range(50):
                    msg = await ws.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        assert payload.get("type") in ("ok", "error")
                        if payload.get("type") == "error":
                            pytest.fail(f"setup failed: {payload.get('error')}")
                        break

        async def read_sum(idx: int):
            qid = f"read_{idx}_{int(time.time() * 1000)}"
            sql = f"SELECT SUM(x) AS s FROM {table}"
            async with session.ws_connect(f"ws://localhost:{port}") as ws1:
                await ws1.send_str(
                    json.dumps({"type": "json", "sql": sql, "queryId": qid})
                )
                for _ in range(200):
                    msg = await ws1.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid and payload.get("type") == "json":
                        return True
            return False

        async def insert_range(a: int, b: int, idx: int):
            qid = f"ins_m_{idx}_{int(time.time() * 1000)}"
            sql = f"INSERT INTO {table} SELECT x FROM generate_series({a},{b}) AS t(x)"
            async with session.ws_connect(f"ws://localhost:{port}") as ws2:
                await ws2.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                for _ in range(400):
                    msg = await ws2.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        return payload.get("type") == "ok"
            return False

        async def ctas_heavy(tname: str, n: int):
            qid = f"ctas_m_{int(time.time() * 1000)}"
            sql = (
                f"CREATE TABLE {tname} AS SELECT x FROM generate_series(1, {n}) AS t(x)"
            )
            async with session.ws_connect(f"ws://localhost:{port}") as ws3:
                await ws3.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                for _ in range(600):
                    msg = await ws3.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        return payload.get("type") == "ok"
            return False

        tasks = [
            *(read_sum(i) for i in range(5)),
            insert_range(1, 20000, 1),
            insert_range(20001, 40000, 2),
            ctas_heavy("t_mixed_ctas", 50000),
        ]
        results = await asyncio.gather(*tasks)
        assert all(results)


@pytest.mark.asyncio
async def test_update_vs_alter_with_retry(server_proc):
    """
    Provoke a transaction conflict by overlapping UPDATE and ALTER on the same
    table. The server is expected to recover by retrying the conflicting
    transaction once and ultimately returning success for both operations.

    After completion, verify final state:
      - column 'z' has been added by ALTER
      - all rows had 'v' incremented to 1 by UPDATE
    """
    port = server_proc["port"]
    table = "t_conflict"
    timeout = aiohttp.ClientTimeout(total=3)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        # Setup table with some rows
        async with session.ws_connect(f"ws://localhost:{port}") as ws:
            cmds = [
                f"DROP TABLE IF EXISTS {table}",
                f"CREATE TABLE {table}(x INT, v INT)",
                f"INSERT INTO {table} SELECT x, 0 FROM generate_series(1, 10000) AS t(x)",
            ]
            for sql in cmds:
                qid = f"setup_{int(time.time() * 1000)}"
                await ws.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                for _ in range(100):
                    msg = await ws.receive()
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        assert payload.get("type") in ("ok", "error")
                        if payload.get("type") == "error":
                            pytest.fail(f"setup failed: {payload.get('error')}")
                        break

        # Long-running update that forces heavy compute on RHS to keep it busy
        async def long_update():
            qid = f"upd_{int(time.time() * 1000)}"
            sql = (
                f"UPDATE {table} SET v = v + 1 "
                f"WHERE x IN (SELECT x FROM generate_series(1, 30000) WHERE x <= 10000)"
            )
            async with session.ws_connect(f"ws://localhost:{port}") as ws1:
                await ws1.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                for _ in range(160):
                    try:
                        msg = await asyncio.wait_for(ws1.receive(), timeout=0.1)
                    except asyncio.TimeoutError:
                        continue
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        return payload.get("type"), payload.get("error", "")
            return "error", "timeout"

        # ALTER that should conflict if it lands mid-update
        async def do_alter():
            qid = f"alt_{int(time.time() * 1000)}"
            sql = f"ALTER TABLE {table} ADD COLUMN z INT"
            async with session.ws_connect(f"ws://localhost:{port}") as ws2:
                await ws2.send_str(
                    json.dumps({"type": "exec", "sql": sql, "queryId": qid})
                )
                for _ in range(160):
                    try:
                        msg = await asyncio.wait_for(ws2.receive(), timeout=0.1)
                    except asyncio.TimeoutError:
                        continue
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    try:
                        payload = json.loads(msg.data)
                    except Exception:
                        continue
                    if payload.get("queryId") == qid:
                        return payload.get("type"), payload.get("error", "")
            return "error", "timeout"

        # Launch both nearly simultaneously
        upd_task = asyncio.create_task(long_update())
        # tiny delay to try and overlap ALTER during UPDATE
        await asyncio.sleep(0.005)
        alt_task = asyncio.create_task(do_alter())
        upd_type, upd_err = await upd_task
        alt_type, alt_err = await alt_task

        # With server-side one-time retry enabled, both should succeed
        assert upd_type == "ok", f"update failed: {upd_err}"
        assert alt_type == "ok", f"alter failed: {alt_err}"

        # Verify schema includes added column 'z'
        qid = f"schema_{int(time.time() * 1000)}"
        sql = f"SELECT name FROM pragma_table_info('{table}')"
        async with session.ws_connect(f"ws://localhost:{port}") as ws4:
            await ws4.send_str(json.dumps({"type": "json", "sql": sql, "queryId": qid}))
            for _ in range(100):
                try:
                    msg = await asyncio.wait_for(ws4.receive(), timeout=0.1)
                except asyncio.TimeoutError:
                    continue
                if msg.type != aiohttp.WSMsgType.TEXT:
                    continue
                try:
                    payload = json.loads(msg.data)
                except Exception:
                    continue
                if payload.get("queryId") == qid and payload.get("type") == "json":
                    arr = json.loads(payload.get("data", "[]"))
                    names = {row.get("name") for row in arr if isinstance(row, dict)}
                    assert "z" in names
                    break
            else:
                pytest.fail("did not receive schema response")

        # Verify all rows have v == 1
        qid2 = f"chk_v_{int(time.time() * 1000)}"
        sql2 = f"SELECT COUNT(*) AS c FROM {table} WHERE v = 1"
        async with session.ws_connect(f"ws://localhost:{port}") as ws5:
            await ws5.send_str(
                json.dumps({"type": "json", "sql": sql2, "queryId": qid2})
            )
            for _ in range(100):
                try:
                    msg = await asyncio.wait_for(ws5.receive(), timeout=0.1)
                except asyncio.TimeoutError:
                    continue
                if msg.type != aiohttp.WSMsgType.TEXT:
                    continue
                try:
                    payload = json.loads(msg.data)
                except Exception:
                    continue
                if payload.get("queryId") == qid2 and payload.get("type") == "json":
                    arr = json.loads(payload.get("data", "[]"))
                    assert isinstance(arr, list) and len(arr) == 1
                    assert arr[0].get("c") == 10000
                    break
            else:
                pytest.fail("did not receive v==1 count response")
