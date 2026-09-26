"""Bounded, coalesced filesystem probes with cached failures and daemon workers.

Stalled mounts can occupy at most eight workers. Calls never enqueue another
probe for an in-flight path, and queued work is bounded by the requested page.
"""

from __future__ import annotations

import os
import queue
import stat
import threading
import time


def probe(path: str) -> dict:
    try:
        info = os.stat(path)
        if not stat.S_ISREG(info.st_mode):
            return {"availability": "invalid", "reason": "not_a_file"}
        with open(path, "rb") as stream:
            header = stream.read(12)
        if header[8:12] != b"DUCK":
            return {"availability": "invalid", "reason": "not_duckdb"}
        return {"availability": "available"}
    except FileNotFoundError:
        return {"availability": "missing", "reason": "not_found"}
    except OSError:
        return {"availability": "inaccessible", "reason": "access_failed"}


class Availability:
    def __init__(self, ttl: float = 30, workers: int = 8, probe_fn=probe):
        self.ttl = ttl
        self.probe = probe_fn
        self.cache: dict[str, dict] = {}
        self.pending: dict[str, threading.Event] = {}
        self.guard = threading.Lock()
        self.queue = queue.Queue(maxsize=1000)
        self.workers = workers
        self.started = False

    def _worker(self):
        while True:
            path = self.queue.get()
            try:
                value = self.probe(path)
            except Exception:
                value = {"availability": "inaccessible", "reason": "access_failed"}
            with self.guard:
                self.cache[path] = {**value, "lastCheckedAt": time.time()}
                self.pending.pop(path).set()
            self.queue.task_done()

    def check(self, paths: list[str], *, refresh=False, budget=1.5) -> dict[str, dict]:
        deadline = time.monotonic() + budget
        events = []
        with self.guard:
            if not self.started:
                self.started = True
                for _ in range(self.workers):
                    threading.Thread(target=self._worker, daemon=True).start()
            for path in paths:
                cached = self.cache.get(path)
                fresh = cached and time.time() - cached["lastCheckedAt"] < self.ttl
                if (refresh or not fresh) and path not in self.pending:
                    event = threading.Event()
                    try:
                        self.queue.put_nowait(path)
                        self.pending[path] = event
                    except queue.Full:
                        pass
                if path in self.pending and (refresh or not fresh):
                    events.append(self.pending[path])
        for event in events:
            event.wait(max(0, deadline - time.monotonic()))
        with self.guard:
            results = {}
            for path in paths:
                if path not in self.cache or (
                    path in self.pending
                    and (
                        refresh
                        or time.time() - self.cache[path]["lastCheckedAt"] >= self.ttl
                    )
                ):
                    self.cache[path] = {
                        "availability": "inaccessible",
                        "reason": "timeout",
                        "lastCheckedAt": time.time(),
                    }
                value = self.cache[path]
                results[path] = {
                    **value,
                    "stale": time.time() - value["lastCheckedAt"] >= self.ttl,
                }
            return results

    def invalidate(self, path):
        with self.guard:
            self.cache.pop(path, None)
