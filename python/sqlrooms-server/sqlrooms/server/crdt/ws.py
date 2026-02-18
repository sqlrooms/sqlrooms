from __future__ import annotations

import base64
import logging
from typing import Any, Dict, Optional

from socketify import OpCode

from loro import ExportMode  # type: ignore

from .state import CrdtState


class CrdtWs:
    """
    CRDT WebSocket handlers for sqlrooms-server.

    Notes:
    - Do not depend on Python `ws` object identity being stable across callbacks.
      Use socketify user_data (conn_id) as the stable identifier for a connection.
    - Guard all Loro access (export/import) with the per-room lock.
    """

    def __init__(
        self,
        *,
        app: Any,
        state: CrdtState,
        allow_client_snapshots: bool,
        empty_snapshot_len: Optional[int],
        save_debounce_ms: int = 500,
        logger: Optional[logging.Logger] = None,
    ):
        self._app = app
        self._state = state
        self._allow_client_snapshots = allow_client_snapshots
        self._empty_snapshot_len = empty_snapshot_len
        self._save_debounce_ms = save_debounce_ms
        self._log = logger or logging.getLogger(__name__)
        self._conn_state: Dict[int, Dict[str, Optional[str]]] = {}

    def register_conn(self, conn_id: int) -> None:
        self._conn_state.setdefault(conn_id, {"room_id": None, "client_id": None})

    def unregister_conn(self, conn_id: int) -> None:
        self._conn_state.pop(conn_id, None)

    def set_conn_room(self, conn_id: int, room_id: str) -> None:
        self.register_conn(conn_id)
        self._conn_state[conn_id]["room_id"] = room_id

    def set_conn_client_id(self, conn_id: int, client_id: str | None) -> None:
        self.register_conn(conn_id)
        self._conn_state[conn_id]["client_id"] = client_id

    def get_room_id(self, conn_id: int) -> Optional[str]:
        return self._conn_state.get(conn_id, {}).get("room_id")

    def get_client_id(self, conn_id: int) -> Optional[str]:
        return self._conn_state.get(conn_id, {}).get("client_id")

    async def handle_join(self, ws, *, conn_id: int, room_id: str) -> None:
        self.set_conn_room(conn_id, room_id)
        client_id = self.get_client_id(conn_id)
        self._log.info(
            f"joining room {room_id} (ws id: {id(ws)}, conn_id: {conn_id}, client_id: {client_id})"
        )

        room = await self._state.ensure_loaded(room_id)
        ws.subscribe(room_id)
        ws.send({"type": "crdt-joined", "roomId": room_id}, OpCode.TEXT)

        # Export snapshot under lock to avoid races with concurrent imports/exports.
        async with room.lock:
            snapshot = room.doc.export(ExportMode.Snapshot())
        self._log.debug(f"sending snapshot to {room_id}: {len(snapshot)} bytes")
        ws.send(
            {
                "type": "crdt-snapshot",
                "roomId": room_id,
                "data": base64.b64encode(snapshot).decode("ascii"),
            },
            OpCode.TEXT,
        )

    async def handle_binary_update(self, ws, *, conn_id: int, payload: bytes) -> None:
        room_id = self.get_room_id(conn_id)
        self._log.debug(
            f"_crdt_update called with payload len: {len(payload)} bytes (ws id: {id(ws)}, conn_id: {conn_id}, client_id: {self.get_client_id(conn_id)})"
        )
        self._log.debug(
            f"resolved room_id: {room_id} (ws id: {id(ws)}, conn_id: {conn_id})"
        )
        if not room_id:
            self._log.warning("no room_id found")
            return

        room = await self._state.ensure_loaded(room_id)
        async with room.lock:
            room.doc.import_(payload)
            update = payload
            await self._state.schedule_save(room_id, delay_ms=self._save_debounce_ms)
        self._log.debug(f"scheduled snapshot save for {room_id}")
        self._log.debug(
            f"publishing update to room {room_id}, len: {len(update)} bytes"
        )
        self._app.publish(room_id, update, OpCode.BINARY)
        self._log.debug(f"published update to room {room_id}")
        ws.send({"type": "crdt-update-ack", "roomId": room_id}, OpCode.TEXT)

    async def handle_client_snapshot(self, ws, *, room_id: str, data_b64: str) -> None:
        if not self._allow_client_snapshots:
            ws.send(
                {"type": "error", "error": "client snapshots disabled"}, OpCode.TEXT
            )
            return

        try:
            payload = base64.b64decode(data_b64.encode("ascii"), validate=True)
        except Exception as exc:
            ws.send({"type": "error", "error": f"invalid snapshot: {exc}"}, OpCode.TEXT)
            return

        room = await self._state.ensure_loaded(room_id)

        # Guard: only allow seeding when the room is still empty (best-effort).
        async with room.lock:
            if self._empty_snapshot_len is None:
                ws.send({"type": "error", "error": "snapshot rejected"}, OpCode.TEXT)
                return
            current = room.doc.export(ExportMode.Snapshot())
            if len(current) > self._empty_snapshot_len + 64:
                ws.send(
                    {
                        "type": "error",
                        "error": "room already has state; snapshot rejected",
                    },
                    OpCode.TEXT,
                )
                return
            room.doc.import_(payload)
            await self._state.schedule_save(room_id, delay_ms=self._save_debounce_ms)
            update = payload

        self._app.publish(room_id, update, OpCode.BINARY)
        ws.send({"type": "crdt-snapshot-ack", "roomId": room_id}, OpCode.TEXT)

    async def maybe_handle_json(self, ws, *, conn_id: int, message: dict) -> bool:
        # Join: { type: 'crdt-join', roomId, clientId? }
        if message.get("type") == "crdt-join":
            room_id = str(message.get("roomId") or "").strip()
            if not room_id:
                ws.send({"type": "error", "error": "missing roomId"}, OpCode.TEXT)
                return True
            client_id = message.get("clientId")
            self.set_conn_client_id(conn_id, str(client_id) if client_id else None)
            await self.handle_join(ws, conn_id=conn_id, room_id=room_id)
            return True

        # Client snapshot: { type: 'crdt-snapshot', roomId, data }
        if message.get("type") == "crdt-snapshot":
            room_id = str(message.get("roomId") or "").strip()
            data_b64 = message.get("data")
            if not room_id or not isinstance(data_b64, str):
                ws.send(
                    {"type": "error", "error": "missing roomId or data"}, OpCode.TEXT
                )
                return True
            await self.handle_client_snapshot(ws, room_id=room_id, data_b64=data_b64)
            return True

        return False
