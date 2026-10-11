from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional

from loro import ExportMode, LoroDoc  # type: ignore


logger = logging.getLogger(__name__)


async def run_sync_work(function, *args):
    """Settle Loro work before releasing its room lock, even on cancellation."""
    task = asyncio.create_task(asyncio.to_thread(function, *args))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        import anyio

        with anyio.CancelScope(shield=True):
            while not task.done():
                try:
                    await asyncio.shield(task)
                except asyncio.CancelledError:
                    continue
        # The mutation may already have applied; callers must mark it dirty
        # before running it and flush during shutdown.
        task.result()
        raise


class RoomDoc:
    def __init__(self, doc: Optional[LoroDoc] = None):
        self.doc = doc or LoroDoc()
        self.lock = asyncio.Lock()
        self.loaded = False
        self.dirty = False
        self.save_task: Optional[asyncio.Task] = None


class CrdtState:
    """Manages per-room LoroDoc with lazy load/save to DuckDB (via db_async helpers)."""

    def __init__(self, runtime):
        self.runtime = runtime
        self._rooms: Dict[str, RoomDoc] = {}

    def _ensure(self, room_id: str) -> RoomDoc:
        if room_id not in self._rooms:
            self._rooms[room_id] = RoomDoc()
        return self._rooms[room_id]

    async def ensure_loaded(self, room_id: str) -> RoomDoc:
        room = self._ensure(room_id)
        if room.loaded:
            return room
        async with room.lock:
            if not room.loaded:
                snapshot = await self.runtime.load_crdt_snapshot(room_id)
                if snapshot:
                    await run_sync_work(room.doc.import_, snapshot)
                room.loaded = True
        return room

    async def save_snapshot(self, room_id: str, doc: LoroDoc) -> None:
        snapshot = await run_sync_work(doc.export, ExportMode.Snapshot())
        await self.runtime.save_crdt_snapshot(room_id, snapshot)

    async def schedule_save(self, room_id: str, delay_ms: int = 500) -> None:
        """Schedule a debounced snapshot save."""
        room = self._ensure(room_id)
        room.dirty = True
        if room.save_task and not room.save_task.done():
            room.save_task.cancel()
        room.save_task = asyncio.create_task(self._delayed_save(room_id, delay_ms))

    async def _delayed_save(self, room_id: str, delay_ms: int) -> None:
        try:
            await asyncio.sleep(delay_ms / 1000)
            await self.flush_room(room_id)
        except asyncio.CancelledError:
            # Task was cancelled by a newer update
            pass
        except Exception:
            logger.exception("Failed to run delayed save for room %s", room_id)

    async def flush_room(self, room_id: str) -> None:
        """Immediately persist a room if dirty."""
        room = self._rooms.get(room_id)
        if room and room.dirty:
            async with room.lock:
                # Re-check dirty under lock
                if room.dirty:
                    await self.save_snapshot(room_id, room.doc)
                    room.dirty = False

    async def flush_all(self) -> None:
        """Flush all dirty rooms (call on shutdown)."""
        dirty_room_ids = [rid for rid, r in self._rooms.items() if r.dirty]
        if not dirty_room_ids:
            return

        logger.info("Flushing %d dirty CRDT rooms", len(dirty_room_ids))
        await asyncio.gather(*(self.flush_room(rid) for rid in dirty_room_ids))

    async def close(self):
        """Settle debounced saves and propagate final persistence failures."""
        tasks = [room.save_task for room in self._rooms.values() if room.save_task]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await self.flush_all()

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
