from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional

from loro import ExportMode, LoroDoc  # type: ignore

from . import db_async

logger = logging.getLogger(__name__)


class RoomDoc:
    def __init__(self, doc: Optional[LoroDoc] = None):
        self.doc = doc or LoroDoc()
        self.lock = asyncio.Lock()
        self.loaded = False


class CrdtState:
    """Manages per-room LoroDoc with lazy load/save to attached DuckDB."""

    def __init__(self):
        self._rooms: Dict[str, RoomDoc] = {}

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
            except Exception:
                logger.exception("Failed to import snapshot for room %s", room_id)
        room.loaded = True
        return room

    async def save_snapshot(self, room_id: str, doc: LoroDoc) -> None:
        snapshot = doc.export(ExportMode.Snapshot())
        await db_async.save_crdt_snapshot(room_id, snapshot)

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

