from __future__ import annotations

import tempfile
import threading
from contextlib import contextmanager
from typing import Any, Iterator


class QueryCache:
    """Small process-local cache used by the websocket query runner."""

    def __init__(self) -> None:
        self.directory = f"{tempfile.gettempdir()}/sqlrooms-memory-cache"
        self._values: dict[str, Any] = {}
        self._locks: dict[str, threading.RLock] = {}
        self._guard = threading.RLock()

    def get(self, key: str) -> Any:
        with self._guard:
            return self._values.get(key)

    def __setitem__(self, key: str, value: Any) -> None:
        with self._guard:
            self._values[key] = value

    @contextmanager
    def lock(self, name: str) -> Iterator[None]:
        with self._guard:
            lock = self._locks.setdefault(name, threading.RLock())
        with lock:
            yield
