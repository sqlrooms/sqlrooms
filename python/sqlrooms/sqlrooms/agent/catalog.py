"""Versioned Recent Workspaces catalog and bounded managed-folder discovery."""

from __future__ import annotations

import json
from pathlib import Path
import time
import uuid

from .storage import WorkspaceError, atomic_json, canonical, home, lock, managed_root
from .availability import Availability
from .discovery import Discovery


class Catalog:
    def __init__(self):
        self.path = home() / "workspaces.json"
        self.availability = Availability()
        self.discovery = Discovery()

    def read(self) -> list[dict]:
        try:
            value = json.loads(self.path.read_text())
            entries = value["workspaces"]
            if value["version"] != 1 or not isinstance(entries, list):
                raise ValueError()
            ids, paths = set(), set()
            for entry in entries:
                if not isinstance(entry, dict) or not all(
                    isinstance(entry.get(k), str)
                    for k in ("workspaceId", "databasePath", "name", "origin")
                ):
                    raise ValueError()
                uuid.UUID(entry["workspaceId"])
                if entry["workspaceId"] in ids or entry["databasePath"] in paths:
                    raise ValueError()
                ids.add(entry["workspaceId"])
                paths.add(entry["databasePath"])
            return entries
        except FileNotFoundError:
            return []
        except (ValueError, KeyError, TypeError, OSError):
            raise WorkspaceError(
                "catalog_invalid",
                f"Cannot read {self.path}. The original catalog has been preserved; repair it before updating history.",
            ) from None

    def _write(self, entries):
        atomic_json(self.path, {"version": 1, "workspaces": entries})

    def get(self, workspace_id: str) -> dict:
        for entry in self.read():
            if entry["workspaceId"] == workspace_id:
                return entry
        raise WorkspaceError("workspace_not_found", "Unknown saved workspace ID.")

    def register(
        self, path: str, *, name=None, profile=None, opened=False, workspace_id=None
    ) -> dict:
        path = canonical(path)
        if path == ":memory:":
            return {
                "workspaceId": workspace_id or str(uuid.uuid4()),
                "databasePath": path,
                "name": name or "Temporary workspace",
                "origin": "temporary",
            }
        with lock("catalog"):
            entries = self.read()
            entry = next((e for e in entries if e["databasePath"] == path), None)
            if entry is None:
                origin = (
                    "managed"
                    if Path(path).is_relative_to(managed_root().resolve())
                    else "external"
                )
                entry = {
                    "workspaceId": workspace_id or str(uuid.uuid4()),
                    "databasePath": path,
                    "name": name or Path(path).stem,
                    "origin": origin,
                    "createdAt": time.time(),
                }
                entries.append(entry)
            if opened:
                entry["lastOpenedAt"] = time.time()
            if profile:
                entry["profile"] = profile
            self._write(entries)
        self.availability.invalidate(path)
        return entry

    def discover(self, live=(), *, refresh=False):
        candidates, pending = self.discovery.scan(refresh=refresh)
        with lock("catalog"):
            entries = self.read()
            known = {e["databasePath"] for e in entries}
            for path in candidates:
                if path not in known:
                    entries.append(
                        {
                            "workspaceId": next(
                                (
                                    r["workspaceId"]
                                    for r in live
                                    if r["databasePath"] == path
                                ),
                                str(uuid.uuid4()),
                            ),
                            "databasePath": path,
                            "name": Path(path).parent.name
                            if Path(path).name == "workspace.duckdb"
                            else Path(path).stem,
                            "origin": "managed",
                            "createdAt": time.time(),
                        }
                    )
                    known.add(path)
            if len(entries) != len(self.read()):
                self._write(entries)

        return pending

    def locate(
        self, workspace_id: str, path: str, *, confirmed: bool, live_ids: set[str]
    ):
        if not confirmed:
            raise WorkspaceError(
                "confirmation_required",
                "Confirm this path is the relocated workspace; SQLRooms cannot prove file identity.",
            )
        path = canonical(path)
        state = self.availability.check([path], refresh=True)[path]
        if state["availability"] != "available":
            raise WorkspaceError(
                "workspace_unavailable",
                "Replacement must be an accessible DuckDB file.",
                **state,
            )
        # Listing only checks headers. Locate validates content in a bounded
        # read-only child before changing the remembered identity.
        import subprocess
        import sys

        try:
            checked = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    "import duckdb,sys; duckdb.connect(sys.argv[1], read_only=True).close()",
                    path,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=2,
            )
            if checked.returncode:
                raise WorkspaceError(
                    "invalid_database",
                    "Replacement could not be validated as a readable DuckDB database.",
                )
        except subprocess.TimeoutExpired:
            raise WorkspaceError(
                "workspace_unavailable",
                "Replacement validation timed out; catalog unchanged.",
            ) from None
        with lock("catalog"):
            entries = self.read()
            entry = next((e for e in entries if e["workspaceId"] == workspace_id), None)
            if not entry:
                raise WorkspaceError(
                    "workspace_not_found", "Unknown saved workspace ID."
                )
            if workspace_id in live_ids:
                raise WorkspaceError(
                    "workspace_in_use",
                    "Close the live instance before locating its file.",
                )
            if any(e["databasePath"] == path and e is not entry for e in entries):
                raise WorkspaceError(
                    "path_conflict", "This path belongs to another workspace."
                )
            entry["databasePath"] = path
            self._write(entries)
        self.availability.invalidate(path)
        return entry

    def forget(self, workspace_id: str):
        with lock("catalog"):
            self._write([e for e in self.read() if e["workspaceId"] != workspace_id])
        return {
            "ok": True,
            "message": "History entry forgotten. Files and running instances are unchanged; managed projects remain discoverable.",
        }

    def rename(self, workspace_id: str, name: str):
        if not name.strip() or len(name) > 200:
            raise WorkspaceError(
                "invalid_input", "Use a workspace title of 1–200 characters."
            )
        with lock("catalog"):
            entries = self.read()
            entry = next((e for e in entries if e["workspaceId"] == workspace_id), None)
            if not entry:
                raise WorkspaceError(
                    "workspace_not_found", "Unknown saved workspace ID."
                )
            entry["name"] = name.strip()
            self._write(entries)
        return entry
