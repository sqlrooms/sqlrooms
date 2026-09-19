"""Caller-scoped explicit cancellation, independent of HTTP response lifetime."""

from __future__ import annotations

import asyncio
import time
import uuid

from .storage import WorkspaceError


class Operations:
    def __init__(self, *, limit=256, ttl=120):
        self.entries = {}
        self.limit = limit
        self.ttl = ttl

    @property
    def active(self):
        return any(
            entry["task"] is not None and not entry["task"].done()
            for entry in self.entries.values()
        )

    def _key(self, caller, operation_id):
        try:
            uuid.UUID(operation_id)
        except (ValueError, TypeError, AttributeError):
            raise WorkspaceError(
                "invalid_operation", "operationId must be a UUID."
            ) from None
        now = time.monotonic()
        self.entries = {
            k: v
            for k, v in self.entries.items()
            if v["task"] is not None
            and not v["task"].done()
            or now - v["created"] < self.ttl
        }
        return (caller.binding, caller.identity, operation_id)

    def _new(self, key):
        if len(self.entries) >= self.limit:
            raise WorkspaceError(
                "operations_busy", "Too many retained operations; retry later."
            )
        entry = {"created": time.monotonic(), "task": None, "status": "pending"}
        self.entries[key] = entry
        return entry

    async def run(self, caller, operation_id, invoke):
        key = self._key(caller, operation_id)
        entry = self.entries.get(key)
        if entry:
            raise WorkspaceError(
                "operation_not_replayed",
                "This operation was already submitted or cancelled.",
                operationId=operation_id,
                status=entry["status"],
            )
        entry = self._new(key)

        async def execute():
            try:
                result = await asyncio.wait_for(invoke(), timeout=35)
                entry["status"] = "completed"
                entry["result"] = result
                return result
            except asyncio.CancelledError:
                entry["status"] = "cancelled_outcome_uncertain"
                return {
                    "ok": False,
                    "code": "cancelled",
                    "message": "Cancellation requested. An already committed or non-cancellable mutation may have completed.",
                    "operationId": operation_id,
                }
            except Exception:
                entry["status"] = "failed_outcome_uncertain"
                raise

        task = entry["task"] = asyncio.create_task(execute())
        # Consume errors even if the HTTP response disappears. The task owns its
        # deadline; an explicit control request is the only caller cancellation.
        task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)
        return await asyncio.shield(task)

    def cancel(self, caller, operation_id):
        key = self._key(caller, operation_id)
        entry = self.entries.get(key)
        if entry is None:
            entry = self._new(key)
            entry["status"] = "cancelled_before_registration"
        elif entry["task"] and not entry["task"].done():
            entry["task"].cancel()
            entry["status"] = "cancellation_requested"
        return {"ok": True, "operationId": operation_id, "status": entry["status"]}

    def status(self, caller, operation_id):
        entry = self.entries.get(self._key(caller, operation_id))
        return {
            "ok": True,
            "operationId": operation_id,
            "status": entry["status"] if entry else "unknown",
            **({"result": entry["result"]} if entry and "result" in entry else {}),
        }
