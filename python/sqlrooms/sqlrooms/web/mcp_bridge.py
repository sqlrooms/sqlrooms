from __future__ import annotations

import asyncio
import hmac
import time
import uuid
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

MCP_BRIDGE_PROTOCOL_VERSION = 1


class McpBridgeError(RuntimeError):
    def __init__(self, code: str, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class McpBridgeBroker:
    """Routes bounded RPC calls to the one initialized SQLRooms browser page."""

    def __init__(
        self,
        token: str,
        *,
        request_timeout: float = 30.0,
        lease_timeout: float = 30.0,
    ):
        self._token = token
        self._request_timeout = request_timeout
        self._lease_timeout = lease_timeout
        self._connection: WebSocket | None = None
        self._page_id: str | None = None
        self._ready = False
        self._last_seen: float | None = None
        self._last_activity: float | None = None
        self._pending: dict[str, asyncio.Future[Any]] = {}
        self._connection_lock = asyncio.Lock()

    def status(self) -> dict[str, Any]:
        return {
            "status": "ready" if self._ready else "waiting",
            "pageId": self._page_id,
            "lastSeen": self._last_seen,
            "recentActivity": bool(
                self._last_activity is not None
                and time.monotonic() - self._last_activity < 1.5
            ),
            "pendingRequests": len(self._pending),
        }

    async def handle_websocket(self, websocket: WebSocket) -> None:
        await websocket.accept()
        try:
            authenticated = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        except Exception:
            await websocket.close(code=4401, reason="authentication required")
            return

        page_id = (
            authenticated.get("pageId") if isinstance(authenticated, dict) else None
        )
        token = authenticated.get("token") if isinstance(authenticated, dict) else None
        if (
            not isinstance(authenticated, dict)
            or authenticated.get("version") != MCP_BRIDGE_PROTOCOL_VERSION
            or authenticated.get("type") != "bridge.authenticate"
            or not isinstance(page_id, str)
            or not isinstance(token, str)
            or not hmac.compare_digest(token, self._token)
        ):
            await websocket.close(code=4401, reason="unauthorized")
            return

        async with self._connection_lock:
            if self._connection is not None:
                if self._lease_is_stale():
                    stale_connection = self._connection
                    self._fail_pending(
                        McpBridgeError(
                            "room_not_ready",
                            "The previous SQLRooms page bridge lease expired.",
                            retryable=True,
                        )
                    )
                    try:
                        await stale_connection.close(
                            code=4408, reason="bridge lease expired"
                        )
                    except Exception:
                        pass
                else:
                    await websocket.send_json(
                        {
                            "version": MCP_BRIDGE_PROTOCOL_VERSION,
                            "type": "bridge.error",
                            "code": "bridge_lease_held",
                            "message": "Another initialized page owns the MCP bridge lease.",
                        }
                    )
                    await websocket.close(code=4409, reason="bridge lease held")
                    return
            self._connection = websocket
            self._page_id = page_id
            self._ready = False
            self._touch()

        await websocket.send_json(
            {
                "version": MCP_BRIDGE_PROTOCOL_VERSION,
                "type": "bridge.authenticated",
            }
        )

        try:
            while True:
                payload = await websocket.receive_json()
                self._touch()
                if not isinstance(payload, dict):
                    continue
                if payload.get("version") != MCP_BRIDGE_PROTOCOL_VERSION:
                    continue
                if payload.get("pageId") != page_id:
                    continue
                message_type = payload.get("type")
                if message_type == "bridge.ready":
                    self._ready = True
                elif message_type == "bridge.gone":
                    return
                elif message_type == "bridge.response":
                    self._resolve_response(payload)
        except WebSocketDisconnect:
            pass
        finally:
            async with self._connection_lock:
                if self._connection is websocket:
                    self._connection = None
                    self._page_id = None
                    self._ready = False
                    self._fail_pending(
                        McpBridgeError(
                            "room_not_ready",
                            "The active SQLRooms page disconnected.",
                            retryable=True,
                        )
                    )

    async def request(
        self,
        method: str,
        params: Any | None = None,
        *,
        timeout: float | None = None,
    ) -> Any:
        connection = self._connection
        if not self._ready or connection is None or self._lease_is_stale():
            self._ready = False
            raise McpBridgeError(
                "room_not_ready",
                "The SQLRooms page is not ready for MCP calls.",
                retryable=True,
            )

        request_id = uuid.uuid4().hex
        self._last_activity = time.monotonic()
        future = asyncio.get_running_loop().create_future()
        self._pending[request_id] = future
        try:
            await connection.send_json(
                {
                    "version": MCP_BRIDGE_PROTOCOL_VERSION,
                    "type": "bridge.request",
                    "requestId": request_id,
                    "method": method,
                    "params": params,
                }
            )
            return await asyncio.wait_for(
                future, timeout=timeout or self._request_timeout
            )
        except asyncio.TimeoutError as exc:
            await self._send_cancel(request_id)
            raise McpBridgeError(
                "bridge_timeout",
                "The SQLRooms page did not reply in time.",
                retryable=True,
            ) from exc
        except asyncio.CancelledError:
            await self._send_cancel(request_id)
            raise
        finally:
            self._pending.pop(request_id, None)

    async def close(self) -> None:
        connection = self._connection
        self._connection = None
        self._page_id = None
        self._ready = False
        self._fail_pending(
            McpBridgeError(
                "room_not_ready", "The MCP bridge is shutting down.", retryable=True
            )
        )
        if connection is not None:
            try:
                await connection.close(code=1001, reason="server shutdown")
            except Exception:
                pass

    def _resolve_response(self, payload: dict[str, Any]) -> None:
        request_id = payload.get("requestId")
        if not isinstance(request_id, str):
            return
        future = self._pending.get(request_id)
        if future is None or future.done():
            return
        if payload.get("ok") is True:
            self._last_activity = time.monotonic()
            future.set_result(payload.get("result"))
            return
        error = payload.get("error")
        if isinstance(error, dict):
            self._last_activity = time.monotonic()
            future.set_exception(
                McpBridgeError(
                    str(error.get("code") or "bridge_error"),
                    str(error.get("message") or "Browser bridge call failed."),
                    retryable=bool(error.get("retryable")),
                )
            )
        else:
            future.set_exception(
                McpBridgeError("bridge_error", "Browser bridge call failed.")
            )

    async def _send_cancel(self, request_id: str) -> None:
        if self._connection is None:
            return
        try:
            await self._connection.send_json(
                {
                    "version": MCP_BRIDGE_PROTOCOL_VERSION,
                    "type": "request.cancel",
                    "requestId": request_id,
                }
            )
        except Exception:
            pass

    def _fail_pending(self, error: Exception) -> None:
        for future in self._pending.values():
            if not future.done():
                future.set_exception(error)
        self._pending.clear()

    def _touch(self) -> None:
        self._last_seen = time.time()

    def _lease_is_stale(self) -> bool:
        return bool(
            self._last_seen is not None
            and time.time() - self._last_seen > self._lease_timeout
        )
