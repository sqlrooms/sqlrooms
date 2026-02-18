from socketify import OpCode


class AuthManager:
    """Bearer auth helper for HTTP and WebSocket paths.

    - If token is None/empty: auth is disabled.
    - For HTTP, use check_http(req) -> bool.
    - For WS, use:
        - on_open(ws)
        - is_authed(ws) -> bool
        - handle_ws_message(ws, msg) -> bool
          Returns True if the message was handled (auth or unauthorized),
          False if the message should proceed to normal processing.
    - on_close(ws) for cleanup.
    """

    def __init__(self, token: str | None):
        self.token = token or None
        self._ws_authed: set[str] = set()

    # ---------- shared ----------
    def _enabled(self) -> bool:
        return bool(self.token)

    def _key(self, ws) -> str:
        try:
            addr = ws.get_remote_address()
            if addr is not None:
                return str(addr)
        except Exception:
            pass
        return f"id:{id(ws)}"

    # ---------- HTTP ----------
    def check_http(self, req) -> bool:
        if not self._enabled():
            return True
        try:
            header = req.get_header("authorization") or req.get_header("Authorization")
        except Exception:
            header = None
        if not header:
            return False
        value = str(header).strip()
        if value.lower().startswith("bearer "):
            value = value[7:].strip()
        return value == self.token

    # ---------- WS ----------
    def on_open(self, ws) -> None:
        # no buffering policy; start unauthenticated
        if not self._enabled():
            # no-op when disabled
            return

    def is_authed(self, ws) -> bool:
        if not self._enabled():
            return True
        return self._key(ws) in self._ws_authed

    def handle_ws_message(self, ws, message: dict) -> bool:
        """Handle auth-related WS messages.

        Returns True if message was consumed (auth/unauthorized response sent),
        otherwise False to let normal processing continue.
        """
        # Disabled: ack auth messages for compatibility; let others pass
        if not self._enabled():
            if isinstance(message, dict) and message.get("type") == "auth":
                try:
                    ws.send({"type": "authAck"}, OpCode.TEXT)
                except Exception:
                    pass
                return True
            return False

        # Enabled: must be authed or send auth
        if not self.is_authed(ws):
            if isinstance(message, dict) and message.get("type") == "auth":
                token = str(message.get("token") or "").strip()
                if token == self.token:
                    self._ws_authed.add(self._key(ws))
                    try:
                        ws.send({"type": "authAck"}, OpCode.TEXT)
                    except Exception:
                        pass
                    return True
                else:
                    try:
                        ws.send({"type": "error", "error": "unauthorized"}, OpCode.TEXT)
                    except Exception:
                        pass
                    return True
            else:
                # strict: no buffering, inform client
                try:
                    ws.send({"type": "error", "error": "unauthorized"}, OpCode.TEXT)
                except Exception:
                    pass
                return True
        else:
            # Already authed: repeat auth gets ack, others continue
            if isinstance(message, dict) and message.get("type") == "auth":
                try:
                    ws.send({"type": "authAck"}, OpCode.TEXT)
                except Exception:
                    pass
                return True
            return False

    def on_close(self, ws) -> None:
        if not self._enabled():
            return
        try:
            self._ws_authed.discard(self._key(ws))
        except Exception:
            pass
