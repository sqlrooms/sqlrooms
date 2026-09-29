"""Explicit product boundary for shared local workspace lifecycle helpers."""

from dataclasses import dataclass, field
import hashlib
import json
import os
from pathlib import Path
import sys

from .contract import CONTRACT


@dataclass(frozen=True)
class ApplicationSettings:
    """Identity, storage, tool contract and process policy supplied by an application.

    Defaults retain SQLRooms behavior. Alternate applications pass their own
    instance throughout Catalog, Manager, Runtime and Connector; no global
    environment or module state is rewritten.
    """

    product: str = "sqlrooms"
    name: str = "SQLRooms"
    environment_prefix: str = "SQLROOMS"
    contract: dict = field(default_factory=lambda: CONTRACT)
    profiles: tuple[str, ...] = ("default", "experimental", "document-charts-maps")
    default_new_profile: str | None = "document-charts-maps"

    def home(self) -> Path:
        from .storage import private_dir

        return private_dir(
            Path(
                os.environ.get(
                    self.environment_prefix + "_HOME",
                    str(Path.home() / ("." + self.product)),
                )
            ).expanduser()
        )

    def managed_root(self) -> Path:
        return Path(
            os.environ.get(
                self.environment_prefix + "_WORKSPACES_DIR",
                str(self.home() / "workspaces"),
            )
        ).expanduser()

    @property
    def tool_hash(self) -> str:
        return hashlib.sha256(
            json.dumps(self.contract, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

    def launch_command(self, path: str, profile: str | None) -> list[str]:
        args = [
            sys.executable,
            "-m",
            self.product,
            "--db-path",
            path,
            "--no-open-browser",
        ]
        if self.profiles:
            args += [
                "--mcp",
                "--execution-mode",
                "external",
                "--profile",
                profile or "default",
            ]
        return args
