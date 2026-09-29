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
@pytest.mark.parametrize("sender_subscribed", [True, False])
async def test_ws_subscribe_notify(server_proc, sender_subscribed):
    port = server_proc["port"]
    token = server_proc["token"]
    channel = "table:orders"
    async with (
        aiohttp.ClientSession() as session,
        authenticated_socket(session, port, token) as sender,
        authenticated_socket(session, port, token) as subscriber,
    ):
        for ws in [sender, subscriber] if sender_subscribed else [subscriber]:
            await ws.send_json({"type": "subscribe", "channel": channel})
            assert await ws.receive_json(timeout=2) == {
                "type": "subscribed",
                "channel": channel,
            }

        payload = {"type": "notify", "channel": channel, "payload": {"op": "update"}}
        await sender.send_json(payload)
        # Both subscribed and unsubscribed senders get exactly one echo, then ack.
        assert await sender.receive_json(timeout=2) == payload
        assert await sender.receive_json(timeout=2) == {
            "type": "notifyAck",
            "channel": channel,
        }
        assert await subscriber.receive_json(timeout=2) == payload
        # A subscribe acknowledgement is a barrier after all earlier fan-out frames.
        await subscriber.send_json({"type": "subscribe", "channel": channel})
        assert await subscriber.receive_json(timeout=2) == {
            "type": "subscribed",
            "channel": channel,
        }
