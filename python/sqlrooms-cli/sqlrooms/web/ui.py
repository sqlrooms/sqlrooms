from __future__ import annotations

from pathlib import Path
from typing import Protocol


class UiProvider(Protocol):
    """Provides a UI bundle directory to be served by the HTTP server."""

    def static_dir(self) -> Path:
        """Return the directory containing the compiled UI assets."""

    def index_html(self) -> Path:
        """Return the path to the UI entrypoint HTML file."""


class BuiltinUiProvider:
    """UI provider for the default UI bundled inside the `sqlrooms` wheel."""

    def static_dir(self) -> Path:
        return Path(__file__).parent / "static"

    def index_html(self) -> Path:
        return self.static_dir() / "index.html"


class DirectoryUiProvider:
    """UI provider for a custom UI bundle located on disk."""

    def __init__(self, directory: str | Path):
        self._dir = Path(directory).expanduser().resolve()

    def static_dir(self) -> Path:
        return self._dir

    def index_html(self) -> Path:
        return self._dir / "index.html"


