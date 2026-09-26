import pytest
from sqlrooms.server.access import LocalAccess
from sqlrooms.server.auth import AuthManager, AuthorizedSocket
from sqlrooms.server.server import handle_upload_arrow_ws


class Socket:
    def __init__(self, connection_id):
        self.connection_id = connection_id
        self.messages = []
        self.closed = False

    def get_user_data(self):
        return self.connection_id

    def get_remote_address(self):
        return "127.0.0.1"

    def send(self, value, *args):
        assert not self.closed, "native send after close"
        self.messages.append(value)

    def end(self, *args):
        self.closed = True


def test_connection_wrappers_share_only_assigned_id_and_reverify_expiry():
    now = [100]
    access = LocalAccess(clock=lambda: now[0], page_ttl=10)
    auth = AuthManager(None, access.verify)
    token = access.redeem(access.ticket())["token"]
    first, second, wrapper = Socket(1), Socket(2), Socket(1)
    auth.on_open(first)
    auth.on_open(second)
    auth.handle_ws_message(first, {"type": "auth", "token": token})
    assert auth.is_authed(wrapper)
    assert not auth.is_authed(second)
    auth.on_close(second)
    assert auth.is_authed(first)
    now[0] = 105
    access.renew(token)
    now[0] = 111
    assert auth.is_authed(first)
    now[0] = 116
    assert not auth.is_authed(first)
    assert not auth.check_lifetime(first)
    assert first.closed


@pytest.mark.asyncio
async def test_upload_completion_never_touches_closed_native_socket(monkeypatch):
    from sqlrooms.server import db_async

    access = LocalAccess()
    auth = AuthManager(None, access.verify)
    raw = Socket(1)
    auth.on_open(raw)
    auth.handle_ws_message(raw, {"type": "auth", "token": access.native_token})
    guarded = AuthorizedSocket(raw, 1, lambda: auth.is_connection_authed(1))

    async def task(*args, **kwargs):
        access.invalidate()
        auth.check_lifetime(raw)
        auth.on_close(raw)

    monkeypatch.setattr(db_async, "run_db_task", task)
    await handle_upload_arrow_ws(
        guarded, {"tableName": "safe", "queryId": "1"}, b"disposable"
    )
    assert raw.closed
    assert not any(m.get("type") == "uploadAck" for m in raw.messages)
