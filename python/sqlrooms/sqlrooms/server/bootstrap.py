"""Single-use browser bootstrap routes shared by local applications."""

import json
from fastapi import Request
from .access import AccessDenied
from .security import bearer


def register_bootstrap_routes(app, access, launch_url):
    """Register ticket exchange, renewal and native-only ticket issuance.

    The caller supplies its launch URL and applies TransportSecurity to requests.
    """

    @app.get("/auth.json")
    async def identity():
        return {"binding": access.binding}

    @app.post("/api/auth/exchange")
    async def exchange(request: Request):
        # Bound the unauthenticated body before JSON decoding.
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > 4096:
                raise AccessDenied()
        try:
            payload = json.loads(data)
            ticket = payload.get("ticket")
            if not isinstance(ticket, str):
                raise AccessDenied()
            return access.redeem(ticket)
        except (ValueError, AttributeError):
            raise AccessDenied()

    @app.post("/api/auth/renew")
    async def renew(request: Request):
        return access.renew(bearer(request.headers))

    @app.post("/api/auth/ticket")
    async def ticket():
        return {"url": launch_url()}
