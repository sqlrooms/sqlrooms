"""HTTP/websocket admission and private native credential storage."""

from __future__ import annotations

import asyncio
import json
from ipaddress import IPv4Address, IPv6Address
import os
from pathlib import Path
import stat
import tempfile
import re
from urllib.parse import urlsplit, urlunsplit

from starlette.responses import JSONResponse
from starlette.websockets import WebSocketDisconnect
from sqlrooms.server.access import AccessDenied, LocalAccess

NO_STORE = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}


def normalize_transport_url(url: str) -> str:
    """Normalize default ports, requiring unambiguous ASCII/IP authorities."""
    try:
        parsed = urlsplit(url)
        defaults = {"http": 80, "https": 443, "ws": 80, "wss": 443}
        if (
            parsed.scheme not in defaults
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError
        host = parsed.hostname
        if not host.isascii():
            raise ValueError
        if ":" in host:
            host = f"[{IPv6Address(host).compressed}]"
        else:
            last_label = host.rstrip(".").rsplit(".", 1)[-1]
            if last_label.isdecimal() or re.fullmatch(r"0x[0-9a-f]+", last_label):
                if str(IPv4Address(host)) != host:
                    raise ValueError
        port = parsed.port
        authority = (
            f"{host}:{port}"
            if port is not None and port != defaults[parsed.scheme]
            else host
        )
        return urlunsplit((parsed.scheme, authority, parsed.path, "", ""))
    except ValueError:
        raise ValueError(
            "Invalid transport URL; use an HTTP or WebSocket URL with an ASCII "
            "hostname (punycode for international names) or canonical IP address, "
            "without credentials, query, or fragment."
        ) from None


def bearer(headers) -> str:
    value = headers.get("authorization", "")
    return (
        value[7:]
        if value.lower().startswith("bearer ")
        else headers.get("x-sqlrooms-token", "")
    )


def check_private(path: Path, *, directory: bool = False) -> None:
    """Reject symlinks, foreign owners, and group/world-accessible POSIX files."""
    if os.name != "posix":
        raise RuntimeError(
            "Private credential files require tested POSIX permissions; Windows ACL support is not yet available."
        )
    info = path.lstat()
    correct_type = (
        stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    )
    if (
        not correct_type
        or info.st_uid != os.getuid()
        or stat.S_IMODE(info.st_mode) & 0o077
    ):
        raise RuntimeError(
            "SQLRooms credential storage must be owner-only and must not be a symlink."
        )


def supports_private_credentials() -> bool:
    """Whether this platform has a tested owner-only native credential store."""
    return os.name == "posix"


class CredentialFile:
    """Temporary owner-only native handoff; the environment contains only its path."""

    def __init__(self, access: LocalAccess, api_url: str, mcp_url: str, ws_url: str):
        if not supports_private_credentials():
            raise RuntimeError("Windows credential ACL support is not yet verified.")
        self.directory = Path(tempfile.mkdtemp(prefix="sqlrooms-credentials-"))
        check_private(self.directory, directory=True)
        self.path = self.directory / "credential.json"
        fd = os.open(self.path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as stream:
            json.dump(
                {
                    "token": access.native_token,
                    "binding": access.binding,
                    "apiUrl": api_url,
                    "mcpUrl": mcp_url,
                    "wsUrl": ws_url,
                },
                stream,
            )
        check_private(self.path)

    def close(self):
        self.path.unlink(missing_ok=True)
        self.directory.rmdir()


def read_credential_file(path: Path) -> dict:
    """Read a private handoff without following a replaceable file symlink."""
    check_private(path.parent, directory=True)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info = os.fstat(stream.fileno())
        if (
            not stat.S_ISREG(info.st_mode)
            or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) & 0o077
        ):
            raise RuntimeError("Unsafe SQLRooms credential file permissions.")
        return json.load(stream)


class TransportSecurity:
    def __init__(self, access: LocalAccess, origins: set[str], hosts: set[str]):
        self.access = access
        self.origins = origins
        self.hosts = hosts

    def check_headers(self, headers):
        if headers.get("host", "") not in self.hosts:
            raise AccessDenied("forbidden")
        origin = headers.get("origin")
        if origin is not None and origin not in self.origins:
            raise AccessDenied("forbidden")

    def authorize(self, headers, operation: str):
        self.check_headers(headers)
        return self.access.verify(bearer(headers), operation)

    async def authenticate_socket(
        self, websocket, operation: str, *, message_type: str = "auth"
    ) -> tuple[str, dict] | None:
        try:
            self.check_headers(websocket.headers)
        except AccessDenied:
            await websocket.close(code=1008)
            return None
        await websocket.accept()
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), 5)
            if len(raw.encode()) > 4096:
                raise AccessDenied()
            message = json.loads(raw)
            if not isinstance(message, dict) or message.get("type") != message_type:
                raise AccessDenied()
            token = message.get("token")
            if not isinstance(token, str):
                raise AccessDenied()
            self.access.verify(token, operation)
            return token, message
        except WebSocketDisconnect:
            return None
        except Exception:
            await websocket.close(code=1008, reason="authentication required")
            return None

    async def watch_socket(self, websocket, token: str, operation: str):
        """Bound expiry/revocation on idle sockets to one second."""
        while True:
            await asyncio.sleep(1)
            try:
                self.access.verify(token, operation)
            except AccessDenied:
                try:
                    await websocket.close(code=1008, reason="authorization expired")
                except (RuntimeError, WebSocketDisconnect):
                    pass  # A concurrent clean disconnect already closed it.
                return


class McpAuthorization:
    """Authorize every HTTP request before the MCP SDK; preserve SDK DNS checks."""

    def __init__(self, app, security: TransportSecurity):
        self.app = app
        self.security = security

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            from starlette.datastructures import Headers

            try:
                caller = self.security.authorize(Headers(scope=scope), "mcp")
                scope.setdefault("state", {})["sqlrooms_caller"] = caller
            except AccessDenied as exc:
                await JSONResponse(
                    {"error": exc.code},
                    status_code=401 if exc.code == "unauthorized" else 403,
                    headers=NO_STORE,
                )(scope, receive, send)
                return

        async def no_store(message):
            if message["type"] == "http.response.start":
                message["headers"] = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower() not in {b"cache-control", b"referrer-policy"}
                ]
                message["headers"].extend(
                    [
                        (b"cache-control", b"no-store"),
                        (b"referrer-policy", b"no-referrer"),
                    ]
                )
            await send(message)

        await self.app(scope, receive, no_store)


async def authenticate_upstream(websocket, token: str, *, timeout: float = 5):
    """Consume the native acknowledgement before any browser frame is relayed."""
    await websocket.send(json.dumps({"type": "auth", "token": token}))
    ack = await asyncio.wait_for(websocket.recv(), timeout)
    if not isinstance(ack, str) or len(ack) > 4096:
        raise AccessDenied()
    try:
        payload = json.loads(ack)
    except ValueError:
        raise AccessDenied() from None
    if not isinstance(payload, dict) or payload.get("type") != "authAck":
        raise AccessDenied()
