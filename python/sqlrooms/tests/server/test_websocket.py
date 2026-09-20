from .conftest import authenticated_socket
import json

import aiohttp
import pytest


@pytest.mark.asyncio
async def test_ws_query_and_correlation(server_proc):
    port = server_proc["port"]
    token = server_proc["token"]
    async with aiohttp.ClientSession() as session:
        async with authenticated_socket(session, port, token) as ws:
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
    token = server_proc["token"]
    async with aiohttp.ClientSession() as session:
        async with authenticated_socket(session, port, token) as ws:
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
    token = server_proc["token"]
    async with aiohttp.ClientSession() as session:
        async with authenticated_socket(session, port, token) as ws:
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
