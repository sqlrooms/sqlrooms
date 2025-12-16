from __future__ import annotations

import asyncio
import logging
import time
from typing import Dict, Optional

from loro import ExportMode, LoroDoc  # type: ignore

from . import db_async

logger = logging.getLogger(__name__)


class RoomDoc:
    def __init__(self, doc: Optional[LoroDoc] = None):
        self.doc = doc or LoroDoc()
        self.lock = asyncio.Lock()
        self.loaded = False
        # Whether this room has ever had meaningful state (from DB load or in-memory updates).
        # Used to avoid new clients "seeding" an existing room with empty initialState.
        self.has_state = False
        self.dirty = False
        self._save_task: Optional[asyncio.Task] = None
        self._last_saved_at = 0.0


class CrdtState:
    """Manages per-room LoroDoc with lazy load/save to attached DuckDB."""

    def __init__(self, save_debounce_ms: int = 750):
        self._rooms: Dict[str, RoomDoc] = {}
        self._save_debounce_s = max(0.0, save_debounce_ms / 1000.0)

    def _ensure(self, room_id: str) -> RoomDoc:
        if room_id not in self._rooms:
            self._rooms[room_id] = RoomDoc()
        return self._rooms[room_id]

    async def ensure_loaded(self, room_id: str) -> RoomDoc:
        room = self._ensure(room_id)
        if room.loaded:
            return room
        snapshot = await db_async.load_crdt_snapshot(room_id)
        if snapshot:
            try:
                room.doc.import_(snapshot)
                room.has_state = True
            except Exception:
                logger.exception("Failed to import snapshot for room %s", room_id)
        room.loaded = True
        return room

    async def save_snapshot(self, room_id: str, doc: LoroDoc) -> None:
        snapshot = doc.export(ExportMode.Snapshot())
        await db_async.save_crdt_snapshot(room_id, snapshot)

    def mark_dirty(self, room_id: str) -> None:
        """
        Mark a room doc as needing persistence and schedule a debounced snapshot save.

        This avoids exporting/writing a full snapshot on every small update; instead,
        we coalesce bursts of updates into periodic snapshot saves.
        """
        room = self._ensure(room_id)
        room.dirty = True
        if room._save_task is not None and not room._save_task.done():
            return
        room._save_task = asyncio.create_task(self._debounced_save(room_id))

    async def _debounced_save(self, room_id: str) -> None:
        room = self._ensure(room_id)
        try:
            while True:
                # Debounce/coalesce bursts of updates.
                if self._save_debounce_s > 0:
                    await asyncio.sleep(self._save_debounce_s)

                # Export snapshot under lock for a consistent view.
                async with room.lock:
                    if not room.dirty:
                        return
                    room.dirty = False
                    snapshot = room.doc.export(ExportMode.Snapshot())

                await db_async.save_crdt_snapshot(room_id, snapshot)
                room._last_saved_at = time.monotonic()

                # If updates arrived while saving, loop and persist again (debounced).
                if not room.dirty:
                    return
        except Exception:
            logger.exception("Failed to persist CRDT snapshot for room %s", room_id)
        finally:
            # Allow future scheduling after this task exits.
            room._save_task = None

    def export_update(self, doc: LoroDoc, from_version=None) -> bytes:
        """
        Export Loro updates since the provided version vector; defaults to current.
        """
        try:
            version = from_version if from_version is not None else doc.version()
            return doc.export(ExportMode.Updates(version))
        except Exception:
            logger.exception("Failed to export updates; falling back to snapshot")
            return doc.export(ExportMode.Snapshot())

