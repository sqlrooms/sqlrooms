"""Small, transport-independent authorization boundary for one live binding."""

from __future__ import annotations

from dataclasses import dataclass
import secrets
import threading
import time
from typing import Callable


class AccessDenied(ValueError):
    """A credential is missing, expired, revoked, or lacks the requested operation."""

    def __init__(self, code: str = "unauthorized"):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class AccessContext:
    """Server-owned identity; client labels and routing hints never establish access."""

    identity: str
    kind: str
    binding: str
    operations: frozenset[str]
    expires_at: float | None


NATIVE_OPERATIONS = frozenset(
    {"query", "read", "config-write", "control", "mcp", "bootstrap"}
)
PAGE_OPERATIONS = frozenset(
    {"query", "read", "config-write", "control", "page-config", "bridge", "renew"}
)


class LocalAccess:
    """Issues revocable credentials and atomic single-use tickets for a database generation.

    Renewal extends the existing page credential so healthy sockets retain their
    authorization and bridge lease. Every dispatch re-verifies the credential.
    """

    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.time,
        page_ttl: float = 1800,
        ticket_ttl: float = 120,
    ):
        self.clock = clock
        self.page_ttl = page_ttl
        self.ticket_ttl = ticket_ttl
        self._lock = threading.RLock()
        self.binding = secrets.token_hex(16)
        self._credentials: dict[str, AccessContext] = {}
        self._tickets: dict[str, tuple[str, float]] = {}
        self.native_token = self.issue("native", NATIVE_OPERATIONS)

    def issue(
        self, kind: str, operations: frozenset[str], ttl: float | None = None
    ) -> str:
        with self._lock:
            token = secrets.token_urlsafe(32)
            self._credentials[token] = AccessContext(
                secrets.token_hex(12),
                kind,
                self.binding,
                operations,
                None if ttl is None else self.clock() + ttl,
            )
            return token

    def verify(
        self, token: str | None, operation: str, *, binding: str | None = None
    ) -> AccessContext:
        with self._lock:
            context = self._credentials.get(token or "")
            if context is None or (
                context.expires_at is not None and context.expires_at <= self.clock()
            ):
                raise AccessDenied()
            if context.binding != self.binding or (
                binding is not None and context.binding != binding
            ):
                raise AccessDenied("stale_binding")
            if operation not in context.operations:
                raise AccessDenied("forbidden")
            return context

    def ticket(self) -> str:
        """Issue from trusted launcher code or after authorizing bootstrap control."""
        with self._lock:
            now = self.clock()
            self._tickets = {
                key: value for key, value in self._tickets.items() if value[1] > now
            }
            if len(self._tickets) >= 64:
                raise AccessDenied("too_many_tickets")
            ticket = secrets.token_urlsafe(32)
            self._tickets[ticket] = (self.binding, now + self.ticket_ttl)
            return ticket

    def redeem(self, ticket: str) -> dict:
        with self._lock:
            entry = self._tickets.pop(ticket, None)
            if entry is None or entry[0] != self.binding or entry[1] <= self.clock():
                raise AccessDenied()
            # Bound state even for long-lived hosts; expired credentials cannot renew.
            self._credentials = {
                key: ctx
                for key, ctx in self._credentials.items()
                if ctx.expires_at is None or ctx.expires_at > self.clock()
            }
            token = self.issue("page", PAGE_OPERATIONS, self.page_ttl)
            return self.describe(token)

    def describe(self, token: str) -> dict:
        context = self.verify(token, "renew")
        return {
            "token": token,
            "binding": context.binding,
            "expiresAt": context.expires_at,
        }

    def renew(self, token: str) -> dict:
        with self._lock:
            ctx = self.verify(token, "renew")
            self._credentials[token] = AccessContext(
                ctx.identity,
                ctx.kind,
                ctx.binding,
                ctx.operations,
                self.clock() + self.page_ttl,
            )
            return self.describe(token)

    def revoke(self, token: str) -> None:
        with self._lock:
            self._credentials.pop(token, None)

    def invalidate(self) -> None:
        """Revoke all authority on shutdown/cutover; destination needs new issuance."""
        with self._lock:
            self._credentials.clear()
            self._tickets.clear()
            self.binding = secrets.token_hex(16)
