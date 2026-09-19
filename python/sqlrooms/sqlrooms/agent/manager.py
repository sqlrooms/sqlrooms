"""Process lifecycle boundary used by MCP, status, and Recent Workspaces."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

from .catalog import Catalog
from . import registry
from .storage import WorkspaceError, canonical, home, lock, managed_root, private_dir

PROFILES = {"default", "experimental", "document-charts-maps"}


class Manager:
    def __init__(self, catalog=None):
        self.catalog = catalog or Catalog()

    def live(self):
        values = registry.records()

        def inspect(record):
            public = registry.public_record(record)
            try:
                # Even advisory observations use the authenticated local API to
                # corroborate identity; they never invent a callable MCP endpoint.
                return {**public, **registry.verify(record)}
            except WorkspaceError as exc:
                return {
                    **public,
                    "verified": False,
                    "lifecycle": "error",
                    "readiness": "unavailable",
                    "error": exc.result,
                }

        with ThreadPoolExecutor(max_workers=8) as pool:
            return list(pool.map(inspect, values))

    def list(self, *, status=None, refresh=False, offset=0, limit=50):
        if status not in (None, "running") or not 1 <= limit <= 200 or offset < 0:
            raise WorkspaceError(
                "invalid_input",
                "Use status=running, limit 1–200, and a nonnegative offset.",
            )
        live = self.live()
        discovery_pending = self.catalog.discover(live, refresh=refresh)
        entries = {
            e["workspaceId"]: {**e, "instances": []} for e in self.catalog.read()
        }
        for instance in live:
            key = instance["workspaceId"]
            entry = entries.setdefault(
                key,
                {
                    "workspaceId": key,
                    "name": instance.get("name") or Path(instance["databasePath"]).stem,
                    "databasePath": instance["databasePath"],
                    "origin": "temporary"
                    if instance["databasePath"] == ":memory:"
                    else "external",
                    "instances": [],
                },
            )
            entry["instances"].append(instance)
        ordered = sorted(
            entries.values(),
            key=lambda e: (-e.get("lastOpenedAt", 0), e["workspaceId"]),
        )
        if status == "running":
            ordered = [
                e for e in ordered if any(i.get("verified") for i in e["instances"])
            ]
        page = ordered[offset : offset + limit]
        checks = self.catalog.availability.check(
            [e["databasePath"] for e in page if e["origin"] != "temporary"],
            refresh=refresh,
        )
        for entry in page:
            entry.update(
                checks.get(
                    entry["databasePath"],
                    {"availability": "temporary", "unsaved": True},
                )
            )
            entry["lifecycle"] = (
                "running"
                if any(i.get("verified") for i in entry["instances"])
                else "error"
                if entry["instances"]
                else "closed"
            )
        return {
            "ok": True,
            "workspaces": page,
            "total": len(ordered),
            "discoveryPending": discovery_pending,
            "nextOffset": offset + limit if offset + limit < len(ordered) else None,
        }

    def target(self, instance_id, *, tools=False, control=False):
        record = next(
            (r for r in registry.records() if r["instanceId"] == instance_id), None
        )
        if not record:
            raise WorkspaceError(
                "stale_target",
                "Instance is no longer registered. List and explicitly reopen the saved workspace; do not replay this operation.",
            )
        status = registry.verify(record, tools=tools, control=control)
        return record, status

    def open(
        self,
        *,
        workspaceId=None,
        path=None,
        create=None,
        profile=None,
        openBrowser=True,
    ):
        if sum(v is not None for v in (workspaceId, path, create)) != 1:
            raise WorkspaceError(
                "invalid_input", "Specify exactly one of workspaceId, path, or create."
            )
        if profile is not None and profile not in PROFILES:
            raise WorkspaceError(
                "invalid_profile",
                "Choose default, experimental, or document-charts-maps.",
            )
        new = create is not None
        if new:
            if not isinstance(create, dict) or set(create) - {"name"}:
                raise WorkspaceError(
                    "invalid_input", "create accepts only an optional name."
                )
            name = create.get("name", "Untitled workspace")
            if not isinstance(name, str) or not name.strip() or len(name) > 200:
                raise WorkspaceError(
                    "invalid_input", "Use a workspace name of 1–200 characters."
                )
            slug = (
                re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "workspace"
            )
            root = managed_root()
            root.mkdir(parents=True, exist_ok=True)
            directory = root / (slug + "-" + uuid.uuid4().hex[:8])
            directory.mkdir(mode=0o700)
            path = str(directory / "workspace.duckdb")
        elif workspaceId:
            entry = self.catalog.get(workspaceId)
            path = entry["databasePath"]
        else:
            name = None
        path = canonical(path)
        # The lock spans discovery, startup and browser-open decision across
        # connector processes. No connector-wide mutable selected workspace.
        with lock("open:" + path, timeout=25):
            entries = self.catalog.read()
            saved = next((e for e in entries if e["databasePath"] == path), None)
            for record in registry.records():
                if record["databasePath"] != path or path == ":memory:":
                    continue
                live = registry.verify(record, tools=True, control=True)
                if live.get("lifecycle") == "stopping":
                    raise WorkspaceError(
                        "workspace_busy",
                        "This workspace is still closing. Wait for it to stop before reopening.",
                    )
                if profile and profile != live["profile"]:
                    raise WorkspaceError(
                        "profile_mismatch",
                        "The running workspace uses another profile. Open without a profile to accept it.",
                        instance=live,
                    )
                if not live["mcpEnabled"]:
                    raise WorkspaceError(
                        "workspace_in_use",
                        "This database is open without MCP. Flush and close it, then relaunch with --mcp.",
                        instance=live,
                    )
                return self._ready(record, openBrowser)
            from .process import check_pending, mark_pending, pending_path

            check_pending(path)
            if workspaceId:
                availability = self.catalog.availability.check([path], refresh=True)[
                    path
                ]
                if availability["availability"] != "available":
                    raise WorkspaceError(
                        "workspace_unavailable",
                        "Saved file unavailable. Locate it or forget the history entry; no replacement was created.",
                        workspaceId=workspaceId,
                        **availability,
                    )
            remembered = (saved or {}).get("profile", "default")
            existing_file = saved is not None or (
                path != ":memory:" and Path(path).exists()
            )
            if not new and existing_file and profile and profile != remembered:
                raise WorkspaceError(
                    "profile_transition_unverified",
                    "Switching this saved project's profile has not been verified to preserve its state. Reopen with its remembered profile.",
                    profile=remembered,
                )
            selected_profile = profile or (
                "document-charts-maps" if new else remembered
            )
            if path != ":memory:":
                # Validate lock/format before spawning; never truncate an existing
                # database. DuckDB's own writer lock remains authoritative.
                try:
                    import duckdb

                    with duckdb.connect(path):
                        pass
                except Exception:
                    raise WorkspaceError(
                        "database_open_failed",
                        "Cannot open the DuckDB file. Check permissions, format, disk space, and other database writers.",
                        databasePath=path,
                    ) from None
            entry = self.catalog.register(path, name=name if new else None)
            command = [
                sys.executable,
                "-m",
                "sqlrooms",
                "--db-path",
                path,
                "--mcp",
                "--execution-mode",
                "external",
                "--profile",
                selected_profile,
                "--no-open-browser",
            ]
            logs = private_dir(home() / "logs")
            log_path = logs / (entry["workspaceId"] + ".log")
            # The worker rotates its own log; connector pipes are never inherited.
            env = {
                **os.environ,
                "SQLROOMS_MANAGED": "1",
                "SQLROOMS_MANAGED_LOG": str(log_path),
            }
            with open(os.devnull, "wb") as sink:
                child = subprocess.Popen(
                    command,
                    stdin=subprocess.DEVNULL,
                    stdout=sink,
                    stderr=sink,
                    cwd=str(home()),
                    env=env,
                    start_new_session=True,
                )
            mark_pending(path, child.pid, entry["workspaceId"])
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                for record in registry.records():
                    if record["pid"] == child.pid and record["databasePath"] == path:
                        pending_path(path).unlink(missing_ok=True)
                        return self._ready(record, openBrowser)
                if child.poll() is not None:
                    pending_path(path).unlink(missing_ok=True)
                    raise WorkspaceError(
                        "startup_failed",
                        "Managed server failed to start. Inspect its local log; the project has been retained.",
                        workspaceId=entry["workspaceId"],
                        logPath=str(log_path),
                    )
                time.sleep(0.1)
            raise WorkspaceError(
                "startup_pending",
                "Startup is still pending; list workspaces before retrying. Do not create another copy.",
                workspaceId=entry["workspaceId"],
                pid=child.pid,
            )

    def _ready(self, record, open_browser):
        result = registry.request(
            record, "/api/agent/browser", payload={"openBrowser": open_browser}
        )
        launch_url = result.get("launchUrl")
        browser_opened = result.get("browserOpened")
        if open_browser:
            deadline = time.monotonic() + 3
            while result["readiness"] != "ready" and time.monotonic() < deadline:
                time.sleep(0.1)
                result = registry.verify(record, tools=True)
        return {
            "ok": True,
            **result,
            **({"launchUrl": launch_url} if launch_url else {}),
            **({"browserOpened": browser_opened} if browser_opened is not None else {}),
        }

    def close(self, *, instanceId):
        record, _ = self.target(instanceId, control=True)
        return registry.request(record, "/api/agent/close", payload={}, timeout=20)

    def locate(self, *, workspaceId, path, confirmed=False):
        entry = self.catalog.get(workspaceId)
        with lock("open:" + entry["databasePath"]):
            return {
                "ok": True,
                "workspace": self.catalog.locate(
                    workspaceId,
                    path,
                    confirmed=confirmed,
                    live_ids={r["workspaceId"] for r in registry.records()},
                ),
            }
