from __future__ import annotations

import tempfile
import threading
from collections import OrderedDict
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Iterator


DEFAULT_MAXSIZE = 1024


@dataclass
class _QueryLock:
    lock: threading.RLock = field(default_factory=threading.RLock)
    users: int = 0


class QueryCache:
    """Small process-local cache used by the websocket query runner."""

    def __init__(
        self,
        *,
        maxsize: int = DEFAULT_MAXSIZE,
    ) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be at least 1")

        self.directory = f"{tempfile.gettempdir()}/sqlrooms-memory-cache"
        self.maxsize = maxsize
        self._values: OrderedDict[str, Any] = OrderedDict()
        self._locks: dict[str, _QueryLock] = {}
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
        # Count waiters before acquisition so a departing holder cannot remove
        # their lock. Idle keys are removed; memory tracks active operations,
        # whose admission is bounded by DuckDBRuntime.
        with self._guard:
            entry = self._locks.get(name)
            if entry is None:
                entry = self._locks[name] = _QueryLock()
            entry.users += 1
        try:
            with entry.lock:
                yield
        finally:
            with self._guard:
                entry.users -= 1
                if entry.users == 0:
                    del self._locks[name]
