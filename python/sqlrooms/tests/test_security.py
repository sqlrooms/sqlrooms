"""Security regressions use disposable sentinel values, never provider calls."""

from concurrent.futures import ThreadPoolExecutor
import json
from urllib.parse import urlsplit

import pytest
from fastapi.testclient import TestClient
from sqlrooms.server.access import AccessDenied, LocalAccess
from sqlrooms.web.launcher import SqlroomsHttpServer
from sqlrooms.web.security import (
    CredentialFile,
    read_credential_file,
    normalize_transport_url,
)


@pytest.fixture
def runtime(tmp_path):
    config = tmp_path / "config.toml"
    config.write_text('[ai]\ndefault_provider = "sentinel"\n')
    return SqlroomsHttpServer(
        tmp_path / "workspace.duckdb",
        "127.0.0.1",
        4173,
        4174,
        mcp_port=4175,
        open_browser=False,
        config_path=config,
        ai_providers={
            "sentinel": {
                "apiKey": "PROVIDER_SENTINEL",
                "baseUrl": "https://provider.invalid",
            }
        },
        ai_custom_models=[{"apiKey": "CUSTOM_SENTINEL", "modelName": "custom"}],
    )


def client(runtime):
    return TestClient(
        runtime._build_app(),
        base_url=runtime._ui_url(),
        headers={"Host": "127.0.0.1:4173"},
    )


def page(runtime):
    return runtime.access.redeem(runtime.access.ticket())


def headers(token):
    return {"Authorization": "Bearer " + token}


@pytest.mark.parametrize("host", ["faß.example", "127.1", "0177.0.0.1", "0x7f000001"])
def test_transport_urls_reject_ambiguous_hosts_instead_of_changing_destination(host):
    with pytest.raises(ValueError, match="ASCII hostname.*canonical IP"):
        normalize_transport_url(f"https://{host}:443")
    assert (
        normalize_transport_url("https://xn--fa-hia.example:443")
        == "https://xn--fa-hia.example"
    )


@pytest.mark.parametrize(
    "configured, origin, ws_url",
    [
        (
            "https://Workspace.Example:443",
            "https://workspace.example",
            "wss://workspace.example/ws/duckdb",
        ),
        (
            "http://workspace.example:80",
            "http://workspace.example",
            "ws://workspace.example/ws/duckdb",
        ),
        (
            "https://workspace.example:8443",
            "https://workspace.example:8443",
            "wss://workspace.example:8443/ws/duckdb",
        ),
        ("http://[::1]:80", "http://[::1]", "ws://[::1]/ws/duckdb"),
    ],
)
def test_external_default_ports_match_browser_bootstrap(
    tmp_path, configured, origin, ws_url
):
    runtime = SqlroomsHttpServer(
        tmp_path / "workspace.db",
        "127.0.0.1",
        4173,
        4174,
        external_url=configured,
        external_ws_url=ws_url,
    )
    with TestClient(
        runtime._build_app(),
        base_url="http://127.0.0.1:4173",
        headers={"Origin": origin, "Host": urlsplit(origin).netloc},
    ) as http:
        assert http.get("/auth.json").status_code == 200
        session = http.post(
            "/api/auth/exchange", json={"ticket": runtime.access.ticket()}
        )
        assert session.status_code == 200
        config = http.get("/api/config", headers=headers(session.json()["token"]))
        assert config.status_code == 200
        assert config.json()["wsUrl"] == ws_url
        assert (
            http.get(
                "/auth.json", headers={"Origin": "https://workspace.example:9443"}
            ).status_code
            == 403
        )
        assert (
            http.get(
                "/auth.json", headers={"Host": "workspace.example:9443"}
            ).status_code
            == 403
        )


def test_explicit_dev_origin_normalizes_default_port(tmp_path, monkeypatch):
    monkeypatch.setenv("SQLROOMS_ALLOWED_ORIGINS", " https://dev.example:443 ")
    runtime = SqlroomsHttpServer(tmp_path / "workspace.db", "127.0.0.1", 4173, 4174)
    with TestClient(runtime._build_app(), base_url="https://dev.example") as http:
        assert (
            http.get(
                "/auth.json", headers={"Origin": "https://dev.example"}
            ).status_code
            == 200
        )


@pytest.mark.parametrize(
    "endpoint",
    [
        "wss://other.example/ws/duckdb",
        "ws://workspace.example/ws/duckdb",
        "wss://workspace.example:4000/ws/duckdb",
        "wss://workspace.example/direct",
    ],
)
def test_split_websocket_endpoint_is_rejected_before_startup(tmp_path, endpoint):
    with pytest.raises(ValueError, match="Split WebSocket endpoints are unsupported"):
        SqlroomsHttpServer(
            tmp_path / "workspace.db",
            "127.0.0.1",
            4173,
            4174,
            external_url="https://workspace.example",
            external_ws_url=endpoint,
        )
    assert not (tmp_path / "sqlrooms_uploads").exists()


def test_matching_mounted_websocket_endpoint_accepts_explicit_default_port(tmp_path):
    runtime = SqlroomsHttpServer(
        tmp_path / "workspace.db",
        "127.0.0.1",
        4173,
        4174,
        external_url="https://workspace.example:443/sqlrooms/",
        external_ws_url="wss://workspace.example:443/sqlrooms/ws/duckdb",
    )
    assert (
        runtime._runtime_config()["wsUrl"]
        == "wss://workspace.example/sqlrooms/ws/duckdb"
    )


@pytest.mark.parametrize(
    "path",
    [
        "/api/config",
        "/config.json",
        "/api/status",
        "/status.json",
        "/api/db/settings",
        "/api/mcp/status",
    ],
)
def test_protected_reads_reject_loopback_invalid_and_forged_identity(runtime, path):
    http = client(runtime)
    for supplied in (
        {},
        headers("wrong"),
        {"X-Forwarded-User": "owner", "X-Forwarded-For": "127.0.0.1"},
    ):
        response = http.get(path, headers=supplied)
        assert response.status_code == 401
        assert response.headers["cache-control"] == "no-store"
        assert "SENTINEL" not in response.text
        assert runtime.session_token not in response.text


@pytest.mark.parametrize("path", ["/api/config", "/config.json"])
def test_only_current_page_can_load_embedded_provider_credentials(runtime, path):
    http = client(runtime)
    wrong_binding = LocalAccess()
    foreign = wrong_binding.redeem(wrong_binding.ticket())["token"]
    limited = runtime.access.issue("query", frozenset({"query", "read"}))
    for token in (
        runtime.session_token,
        runtime.access.upstream_token,
        limited,
        foreign,
    ):
        response = http.get(path, headers=headers(token))
        assert response.status_code in {401, 403}
        assert "SENTINEL" not in response.text
    credential = page(runtime)
    for _ in range(2):  # refresh uses the same page-only boundary
        response = http.get(path, headers=headers(credential["token"]))
        assert response.status_code == 200
        assert "PROVIDER_SENTINEL" in response.text
        assert "CUSTOM_SENTINEL" in response.text
        assert runtime.session_token not in response.text
        assert "wsAuthToken" not in response.json()
    runtime.execution_mode = "external"
    assert "SENTINEL" not in http.get(path, headers=headers(credential["token"])).text
    runtime.access.revoke(credential["token"])
    assert http.get(path, headers=headers(credential["token"])).status_code == 401


@pytest.mark.parametrize(
    "path,payload",
    [
        (
            "/api/ai/settings",
            {
                "settings": {
                    "providers": {
                        "sentinel": {
                            "baseUrl": "https://attacker.invalid",
                            "apiKey": "WRITE_SENTINEL",
                        }
                    }
                }
            },
        ),
        (
            "/api/db/settings",
            {
                "connections": [
                    {
                        "id": "pg",
                        "engineId": "postgres",
                        "config": {
                            "host": "attacker.invalid",
                            "password": "WRITE_SENTINEL",
                        },
                    }
                ]
            },
        ),
    ],
)
def test_settings_reject_before_any_mutation(runtime, path, payload):
    before = runtime.config_path.read_bytes()
    state = json.dumps(runtime.ai_providers)
    http = client(runtime)
    read_only = runtime.access.issue("reader", frozenset({"read"}))
    for supplied, status in (
        ({}, 401),
        (headers("bad"), 401),
        (headers(read_only), 403),
    ):
        response = http.put(path, json=payload, headers=supplied)
        assert response.status_code == status
        assert runtime.config_path.read_bytes() == before
        assert json.dumps(runtime.ai_providers) == state
        assert "WRITE_SENTINEL" not in response.text


def test_public_health_and_host_origin_rules(runtime):
    http = client(runtime)
    assert http.get("/healthz").json() == {"status": "ok"}
    assert set(http.get("/auth.json").json()) == {"binding"}
    for host in ("attacker.invalid:4173", "localhost:9999"):
        assert http.get("/healthz", headers={"Host": host}).status_code == 403
    for origin in ("http://attacker.invalid", "http://localhost:9999", "null"):
        assert (
            http.post(
                "/api/auth/exchange",
                json={"ticket": runtime.access.ticket()},
                headers={"Origin": origin},
            ).status_code
            == 403
        )
        with pytest.raises(Exception):
            with http.websocket_connect("/ws/duckdb", headers={"Origin": origin}):
                pytest.fail("foreign origin admitted")
    preflight = http.options(
        "/api/config",
        headers={
            "Origin": "http://localhost:4173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:4173"


def test_ticket_atomicity_expiry_binding_and_renewal():
    now = [100.0]
    access = LocalAccess(clock=lambda: now[0], page_ttl=10, ticket_ttl=2)
    ticket = access.ticket()

    def redeem():
        try:
            return access.redeem(ticket)
        except AccessDenied:
            return None

    with ThreadPoolExecutor(8) as executor:
        results = list(executor.map(lambda _: redeem(), range(8)))
    assert len([r for r in results if r]) == 1
    credential = next(r for r in results if r)
    now[0] += 1
    renewed = access.renew(credential["token"])
    assert renewed["token"] == credential["token"]
    assert renewed["binding"] == credential["binding"]
    assert renewed["expiresAt"] == 111
    with pytest.raises(AccessDenied):
        access.verify(credential["token"], "mcp")
    with pytest.raises(AccessDenied):
        access.verify(credential["token"], "query", binding="other")
    expired_ticket = access.ticket()
    now[0] += 3
    with pytest.raises(AccessDenied):
        access.redeem(expired_ticket)
    now[0] = 111
    with pytest.raises(AccessDenied):
        access.renew(credential["token"])
    pending = access.ticket()
    native = access.native_token
    access.invalidate()
    for action in (
        lambda: access.verify(native, "query"),
        lambda: access.redeem(pending),
    ):
        with pytest.raises(AccessDenied):
            action()


def test_private_file_permissions_cleanup_and_symlink(runtime, tmp_path):
    handoff = CredentialFile(
        runtime.access, runtime._ui_url(), runtime._mcp_url(), runtime._ws_url()
    )
    try:
        record = read_credential_file(handoff.path)
        assert record["token"] == runtime.session_token
        handoff.path.chmod(0o644)
        with pytest.raises(RuntimeError):
            read_credential_file(handoff.path)
        handoff.path.chmod(0o600)
        link = handoff.directory / "symlink"
        link.symlink_to(handoff.path)
        with pytest.raises(OSError):
            read_credential_file(link)
        link.unlink()
    finally:
        handoff.close()
    assert not handoff.path.exists()


def test_http_mcp_requires_native_scope(runtime):
    http = TestClient(runtime.mcp_service.app, base_url=runtime._mcp_url())
    assert http.post("/mcp", json={}).status_code == 401
    assert (
        http.post("/mcp", json={}, headers=headers(page(runtime)["token"])).status_code
        == 403
    )
    assert (
        http.post(
            "/mcp",
            json={},
            headers={
                **headers(runtime.session_token),
                "Origin": "https://foreign.invalid",
            },
        ).status_code
        == 403
    )


def test_bridge_rechecks_revocation_and_preserves_lease_on_renew(runtime):
    http = client(runtime)
    credential = page(runtime)
    with http.websocket_connect("/ws/mcp-bridge") as ws:
        ws.send_json(
            {
                "version": 1,
                "type": "bridge.authenticate",
                "pageId": "p",
                "token": credential["token"],
            }
        )
        assert ws.receive_json()["type"] == "bridge.authenticated"
        ws.send_json({"version": 1, "type": "bridge.ready", "pageId": "p"})
        response = http.post("/api/auth/renew", headers=headers(credential["token"]))
        assert response.status_code == 200
        assert runtime.mcp_broker._connection is not None
        assert runtime.mcp_broker._page_id == "p"
        runtime.access.revoke(credential["token"])
        assert runtime.mcp_broker.status()["status"] == "waiting"
        with pytest.raises(Exception):
            ws.receive_json()


def test_exchange_replay_wrong_instance_and_size(runtime):
    http = client(runtime)
    ticket = runtime.access.ticket()
    foreign = LocalAccess()
    assert (
        http.post("/api/auth/exchange", json={"ticket": foreign.ticket()}).status_code
        == 401
    )
    response = http.post("/api/auth/exchange", json={"ticket": ticket})
    assert response.status_code == 200
    assert http.post("/api/auth/exchange", json={"ticket": ticket}).status_code == 401
    assert http.post("/api/auth/exchange", content=b"x" * 4097).status_code == 401
    assert http.post("/api/auth/ticket").status_code == 401
    assert (
        http.post(
            "/api/auth/ticket", headers=headers(response.json()["token"])
        ).status_code
        == 403
    )
    assert (
        "#sqlrooms-ticket="
        in http.post("/api/auth/ticket", headers=headers(runtime.session_token)).json()[
            "url"
        ]
    )


def test_provider_environment_config_aliases_never_leak(runtime, monkeypatch):
    from sqlrooms.cli import _load_ai_runtime_config

    monkeypatch.setenv("SQLROOMS_TEST_PROVIDER_KEY", "ENV_SENTINEL")
    runtime.config_path.write_text("""[ai]
[[ai.providers]]
id = "inline"
base_url = "https://inline.invalid"
api_key = "INLINE_SENTINEL"
[[ai.providers]]
id = "env"
base_url = "https://env.invalid"
api_key_env = "SQLROOMS_TEST_PROVIDER_KEY"
[[ai.custom_models]]
model_name = "custom"
base_url = "https://custom.invalid"
api_key = "CUSTOM_SENTINEL"
""")
    _, _, runtime.ai_providers, runtime.ai_custom_models, _ = _load_ai_runtime_config(
        runtime.config_path
    )
    http = client(runtime)
    for alias in ("/api/config", "/config.json"):
        assert "SENTINEL" not in http.get(alias).text
        assert (
            "SENTINEL"
            not in http.get(alias, headers=headers(runtime.session_token)).text
        )
        response = http.get(alias, headers=headers(page(runtime)["token"]))
        assert response.status_code == 200
        assert all(
            key in response.text
            for key in ("ENV_SENTINEL", "INLINE_SENTINEL", "CUSTOM_SENTINEL")
        )


def test_connector_errors_are_redacted(runtime, monkeypatch):
    def fail(*args):
        raise RuntimeError("CONNECTOR_PASSWORD_SENTINEL")

    monkeypatch.setattr(runtime.db_bridge_registry, "test_connection", fail)
    response = client(runtime).post(
        "/api/db/test-connection",
        headers=headers(runtime.session_token),
        json={"connectionId": "fake"},
    )
    assert response.json() == {"ok": False, "error": "Operation failed"}


@pytest.mark.asyncio
async def test_startup_failure_revokes_and_removes_private_file(runtime, monkeypatch):
    monkeypatch.setattr(runtime, "_assert_ui_available", lambda: None)

    async def fail(_):
        raise RuntimeError("startup failed")

    monkeypatch.setattr(runtime, "_serve", fail)
    native = runtime.session_token
    with pytest.raises(RuntimeError):
        await runtime.start()
    assert not runtime.credential_file.path.exists()
    with pytest.raises(AccessDenied):
        runtime.access.verify(native, "query")


@pytest.mark.asyncio
async def test_browser_launch_without_native_store_still_bootstraps(
    runtime, monkeypatch, caplog
):
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        "sqlrooms.web.launcher.supports_private_credentials", lambda: False
    )
    monkeypatch.setattr(runtime, "_assert_ui_available", lambda: None)
    monkeypatch.setattr(runtime, "_start_duckdb_backend", lambda: None)
    monkeypatch.setattr(runtime, "_stop_mcp", AsyncMock())
    monkeypatch.setattr(runtime.mcp_broker, "close", AsyncMock())
    runtime.open_browser = False

    class Http:
        should_exit = False

        async def serve(self):
            assert runtime.credential_file is None
            http = client(runtime)
            assert http.get("/api/config").status_code == 401
            result = http.post(
                "/api/auth/exchange", json={"ticket": runtime.access.ticket()}
            )
            assert result.status_code == 200
            response = http.get("/api/config", headers=headers(result.json()["token"]))
            assert response.status_code == 200
            assert runtime.session_token not in response.text

    monkeypatch.setattr("sqlrooms.web.launcher.uvicorn.Server", lambda _: Http())
    await runtime.start()
    assert runtime.credential_file is None
    assert runtime.session_token not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["claude", "mcp", "no-ui", "mcp-control"])
async def test_native_modes_without_safe_store_fail_explicitly(
    runtime, monkeypatch, mode
):
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        "sqlrooms.web.launcher.supports_private_credentials", lambda: False
    )
    monkeypatch.setattr(runtime, "_assert_ui_available", lambda: None)
    runtime.mcp_enabled_default = mode == "mcp"
    runtime.serve_ui = mode != "no-ui"
    with pytest.raises(RuntimeError, match="Windows ACL support is not yet available"):
        if mode == "mcp-control":
            await runtime._start_mcp()
        else:
            await runtime.start(session=AsyncMock() if mode == "claude" else None)
    assert runtime.credential_file is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "reply", ['{"type":"error"}', "invalid", b"binary", "null", "x" * 4097, None]
)
async def test_upstream_rejection_and_timeout_are_not_relayed(reply):
    import asyncio
    from sqlrooms.web.security import authenticate_upstream

    class Upstream:
        sent = []

        async def send(self, frame):
            self.sent.append(json.loads(frame))

        async def recv(self):
            if reply is None:
                await asyncio.Event().wait()
            return reply

    upstream = Upstream()
    with pytest.raises((AccessDenied, asyncio.TimeoutError)):
        await authenticate_upstream(upstream, "upstream-only", timeout=0.01)
    assert upstream.sent[-1] == {"type": "auth", "token": "upstream-only"}


@pytest.mark.asyncio
async def test_proxy_consumes_repeated_page_auth_without_forwarding(runtime):
    import asyncio
    from sqlrooms.web.launcher import _relay_duckdb_websockets

    credential = page(runtime)
    query = json.dumps({"type": "json", "sql": "SELECT 1"})

    class Browser:
        ack = []
        frames = iter(
            [
                {
                    "type": "websocket.receive",
                    "text": json.dumps({"type": "auth", "token": credential["token"]}),
                },
                {"type": "websocket.receive", "text": query},
                {"type": "websocket.receive", "bytes": b"arrow"},
                {"type": "websocket.disconnect"},
            ]
        )

        async def receive(self):
            return next(self.frames)

        async def send_json(self, value):
            self.ack.append(value)

    class Upstream:
        frames = []
        closed = False

        async def send(self, value):
            self.frames.append(value)

        async def close(self):
            self.closed = True

        def __aiter__(self):
            return self

        async def __anext__(self):
            await asyncio.Event().wait()

    browser, upstream = Browser(), Upstream()
    await _relay_duckdb_websockets(
        browser, upstream, runtime.security, credential["token"]
    )
    assert upstream.frames == [query, b"arrow"]
    assert browser.ack == [{"type": "authAck"}]
    assert upstream.closed


@pytest.mark.parametrize(
    "path,payload",
    [
        (
            "/api/ai/settings",
            {
                "settings": {
                    "providers": {
                        "sentinel": {
                            "baseUrl": "https://authorized.invalid",
                            "apiKey": "AUTHORIZED_SENTINEL",
                        }
                    }
                }
            },
        ),
        (
            "/api/db/settings",
            {
                "connections": [
                    {
                        "id": "authorized",
                        "engineId": "postgres",
                        "config": {
                            "host": "authorized.invalid",
                            "user": "test",
                            "database": "test",
                            "password": "AUTHORIZED_SENTINEL",
                        },
                    }
                ]
            },
        ),
    ],
)
def test_authorized_settings_persist_without_secret_acknowledgements(
    runtime, path, payload
):
    response = client(runtime).put(
        path, json=payload, headers=headers(runtime.session_token)
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert "AUTHORIZED_SENTINEL" not in response.text
    assert "authorized.invalid" in runtime.config_path.read_text()


def test_expired_page_config_is_rejected_on_both_aliases(runtime):
    now = [100.0]
    runtime.access.clock = lambda: now[0]
    credential = page(runtime)
    now[0] = credential["expiresAt"]
    for alias in ("/api/config", "/config.json"):
        response = client(runtime).get(alias, headers=headers(credential["token"]))
        assert response.status_code == 401
        assert "SENTINEL" not in response.text


def test_local_file_resolution_authentication_and_path_validation(
    runtime, tmp_path, monkeypatch
):
    monkeypatch.setenv("HOME", str(tmp_path))
    source = tmp_path / "car's.csv"
    source.write_text("name,mpg\nA,24\n")
    with client(runtime) as http:
        assert (
            http.post("/api/local-file", json={"path": "~/car's.csv"}).status_code
            == 401
        )
        auth = headers(page(runtime)["token"])
        response = http.post(
            "/api/local-file", json={"path": "~/car's.csv"}, headers=auth
        )
        assert response.status_code == 200
        assert response.json() == {"path": str(source.resolve()), "format": "csv"}
        for payload in [
            {"path": "~/missing.csv"},
            {"path": str(tmp_path)},
            {"path": "file://" + str(source)},
            {"path": str(source), "format": []},
            {"path": str(source), "format": ["csv"]},
            {"path": str(source), "tableName": "extra"},
        ]:
            assert (
                http.post("/api/local-file", json=payload, headers=auth).status_code
                == 400
            )
        glob_source = tmp_path / "sales[1].csv"
        glob_source.write_text("value\n123\n")
        assert (
            http.post(
                "/api/local-file", json={"path": str(glob_source)}, headers=auth
            ).status_code
            == 400
        )
        runtime.agent_runtime.stopping = True
        assert (
            http.post(
                "/api/local-file", json={"path": str(source)}, headers=auth
            ).status_code
            == 403
        )
