"""Connection-local authentication, shared by every DuckDB message path."""

import hmac
import time
from socketify import OpCode
from .access import AccessDenied


class AuthManager:
    def __init__(self, token: str | None, verifier=None):
        self.token = token or None
        self.verifier = verifier
        self._tokens: dict[int, str] = {}
        self._opened: dict[int, float] = {}

    def _enabled(self) -> bool:
        return bool(self.token or self.verifier)

    def _key(self, ws) -> int:
        # socketify may create multiple Python wrappers for a connection. Neither
        # wrapper identity nor remote IP is a connection identity.
        return int(ws.get_user_data())

    def _verify(self, token: str) -> bool:
        if self.verifier:
            try:
                self.verifier(token, "query")
                return True
            except AccessDenied:
                return False
        return bool(
            self.token and hmac.compare_digest(token.encode(), self.token.encode())
        )

    def check_http(self, req) -> bool:
        if not self._enabled():
            return True
        value = req.get_header("authorization") or ""
        return value.lower().startswith("bearer ") and self._verify(value[7:])

    def on_open(self, ws) -> None:
        self._opened[self._key(ws)] = time.monotonic()

    def is_authed(self, ws) -> bool:
        return self.is_connection_authed(self._key(ws))

    def is_connection_authed(self, key: int) -> bool:
        if key not in self._opened:
            return False
        if not self._enabled():
            return True
        token = self._tokens.get(key)
        return token is not None and self._verify(token)

    def reject(self, ws):
        ws.send({"type": "error", "error": "unauthorized"}, OpCode.TEXT)
        ws.end(1008, "unauthorized")

    def check_lifetime(self, ws) -> bool:
        key = self._key(ws)
        if key not in self._opened:
            return False
        if self._enabled() and (
            (key in self._tokens and not self.is_authed(ws))
            or (key not in self._tokens and time.monotonic() - self._opened[key] >= 5)
        ):
            self.reject(ws)
            return False
        return True

    def handle_ws_message(self, ws, message: dict) -> bool:
        if isinstance(message, dict) and message.get("type") == "auth":
            token = message.get("token")
            if not self._enabled() or (isinstance(token, str) and self._verify(token)):
                self._tokens[self._key(ws)] = token or ""
                ws.send({"type": "authAck"}, OpCode.TEXT)
            else:
                self.reject(ws)
            return True
        if not self.is_authed(ws):
            self.reject(ws)
            return True
        return False

    def on_close(self, ws) -> None:
        key = self._key(ws)
        self._tokens.pop(key, None)
        self._opened.pop(key, None)


class AuthorizedSocket:
    """Guard native socket operations after awaits against close/expiry/revocation.

    socketify wrappers retain native pointers after close. Domain handlers must
    never dereference those pointers after authorization or connection lifetime
    ends. The predicate consults server-owned state, not the native wrapper.
    """

    def __init__(self, ws, connection_id: int, is_live):
        self._ws = ws
        self._connection_id = connection_id
        self._is_live = is_live

    def get_user_data(self):
        return self._connection_id

    def send(self, *args, **kwargs):
        if self._is_live():
            return self._ws.send(*args, **kwargs)
        return False

    def subscribe(self, *args, **kwargs):
        if self._is_live():
            return self._ws.subscribe(*args, **kwargs)
        return False
