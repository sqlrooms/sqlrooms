from __future__ import annotations

import tempfile
import threading
from collections import OrderedDict
from contextlib import contextmanager
from typing import Any, Iterator


DEFAULT_MAXSIZE = 1024
DEFAULT_STRIPE_COUNT = 64


class QueryCache:
    """Small process-local cache used by the websocket query runner."""

    def __init__(
        self,
        *,
        maxsize: int = DEFAULT_MAXSIZE,
        stripe_count: int = DEFAULT_STRIPE_COUNT,
    ) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be at least 1")
        if stripe_count < 1:
            raise ValueError("stripe_count must be at least 1")

        self.directory = f"{tempfile.gettempdir()}/sqlrooms-memory-cache"
        self.maxsize = maxsize
        self.stripe_count = stripe_count
        self._values: OrderedDict[str, Any] = OrderedDict()
        self._lock_stripes = tuple(threading.RLock() for _ in range(stripe_count))
        self._guard = threading.RLock()

    def get(self, key: str) -> Any:
        with self._guard:
            try:
                value = self._values[key]
            except KeyError:
                return None
            self._values.move_to_end(key)
            return value

    def __setitem__(self, key: str, value: Any) -> None:
        with self._guard:
            self._values[key] = value
            self._values.move_to_end(key)
            while len(self._values) > self.maxsize:
                self._values.popitem(last=False)

    @contextmanager
    def lock(self, name: str) -> Iterator[None]:
        lock = self._lock_stripes[hash(name) % self.stripe_count]
        with lock:
            yield
