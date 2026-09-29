"""Owner-only, locked atomic storage; no database identity is embedded on disk."""

from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time

from ..web.security import check_private


class WorkspaceError(RuntimeError):
    def __init__(self, code: str, message: str, **details):
        super().__init__(message)
        self.result = {"ok": False, "code": code, "message": message, **details}


def home() -> Path:
    path = Path(
        os.environ.get("SQLROOMS_HOME", str(Path.home() / ".sqlrooms"))
    ).expanduser()
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    check_private(path, directory=True)
    return path


def managed_root() -> Path:
    return Path(
        os.environ.get("SQLROOMS_WORKSPACES_DIR", str(home() / "workspaces"))
    ).expanduser()


def private_dir(path: Path) -> Path:
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    check_private(path, directory=True)
    return path


@contextmanager
def lock(name: str, *, timeout: float = 10, settings=None):
    import fcntl

    directory = private_dir((settings.home() if settings else home()) / "locks")
    path = directory / (hashlib.sha256(name.encode()).hexdigest() + ".lock")
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        deadline = time.monotonic() + timeout
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise WorkspaceError(
                        "workspace_busy",
                        "Another workspace operation is still in progress.",
                    )
                time.sleep(0.025)
        yield
    finally:
        os.close(fd)


def atomic_json(path: Path, value):
    private_dir(path.parent)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".write-")
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def canonical(path: str) -> str:
    if path == ":memory:":
        return path
    return str(Path(path).expanduser().resolve())
