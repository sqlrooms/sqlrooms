"""Host file resolution keeps stalled filesystems off the server event loop."""

import asyncio
import json
import threading

import pytest
from starlette.requests import Request
from sqlrooms.web import local_file


def request():
    async def receive():
        return {"type": "http.request", "body": b'{"path":"/stalled.csv"}'}

    return Request({"type": "http"}, receive)


@pytest.mark.asyncio
async def test_stalled_resolution_has_bounded_workers_and_times_out(monkeypatch):
    release = threading.Event()
    started = []

    def stalled(body):
        started.append(body)
        release.wait(5)
        return local_file.JSONResponse({"path": "/stalled.csv", "format": "csv"})

    monkeypatch.setattr(local_file, "_resolve", stalled)
    monkeypatch.setattr(local_file, "_slots", threading.BoundedSemaphore(4))
    pending = [
        asyncio.create_task(local_file.resolve_local_file(request())) for _ in range(4)
    ]
    try:
        for _ in range(100):
            if len(started) == 4:
                break
            await asyncio.sleep(0.01)
        assert len(started) == 4
        assert (await local_file.resolve_local_file(request())).status_code == 503
        responses = await asyncio.wait_for(asyncio.gather(*pending), 3)
        assert all(response.status_code == 408 for response in responses)
        assert "timed out" in json.loads(responses[0].body)["message"]
        assert (await local_file.resolve_local_file(request())).status_code == 503
    finally:
        release.set()
        await asyncio.gather(*pending, return_exceptions=True)
        # Let daemon completions release their original semaphore before restoring it.
        for _ in range(100):
            if local_file._slots._value == 4:
                break
            await asyncio.sleep(0.01)
