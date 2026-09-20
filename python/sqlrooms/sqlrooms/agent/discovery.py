"""Bound managed-root scans without accumulating workers on unavailable mounts."""

import threading
import time

from .storage import managed_root


class Discovery:
    def __init__(self, settings=None):
        self.settings = settings
        self.guard = threading.Lock()
        self.pending = None
        self.paths = []
        self.checked_at = 0.0

    def scan(self, *, refresh=False, budget=0.25):
        with self.guard:
            if self.pending is None and (refresh or time.time() - self.checked_at > 30):
                self.pending = threading.Event()
                threading.Thread(target=self._scan, daemon=True).start()
            event = self.pending
        if event:
            event.wait(budget)
        with self.guard:
            return list(self.paths), self.pending is not None

    def _scan(self):
        paths = []
        try:
            root = (
                self.settings.managed_root() if self.settings else managed_root()
            ).resolve()
            if root.is_dir():
                for index, child in enumerate(root.iterdir()):
                    if index >= 1000:
                        break
                    resolved = child.resolve()
                    if not resolved.is_relative_to(root):
                        continue
                    path = (
                        resolved / "workspace.duckdb" if resolved.is_dir() else resolved
                    )
                    if (
                        path.suffix == ".duckdb"
                        and path.resolve().is_relative_to(root)
                        and path.is_file()
                    ):
                        paths.append(str(path.resolve()))
        except OSError:
            pass
        finally:
            with self.guard:
                self.paths = paths
                self.checked_at = time.time()
                event = self.pending
                self.pending = None
                event.set()
