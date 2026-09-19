import pytest

from sqlrooms.server.server import _normalize_target_relation


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("my_table", '"my_table"'),
        ("analytics.events", '"analytics"."events"'),
        ("  users  ", '"users"'),
    ],
)
def test_normalize_target_relation_accepts_safe_identifiers(raw: str, expected: str):
    assert _normalize_target_relation(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "orders; drop table users;--",
        "foo.bar.baz",
        '"quoted"."table"',
        "schema.table where 1=1",
        "table-name",
    ],
)
def test_normalize_target_relation_rejects_unsafe_input(raw: str):
    with pytest.raises(ValueError):
        _normalize_target_relation(raw)


@pytest.mark.parametrize("attempts", [1, 3])
def test_listener_collision_only_reports_ready_after_success(attempts):
    import json
    import socket
    import subprocess
    import sys
    import textwrap

    with socket.socket(socket.AF_INET6) as occupied:
        occupied.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        occupied.bind(("::", 0))
        occupied.listen()
        port = occupied.getsockname()[1]
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                textwrap.dedent("""
                import json, os, sys
                from sqlrooms.server import db_async
                from sqlrooms.server.cache import QueryCache
                from sqlrooms.server.server import server
                db_async.init_global_connection(':memory:')
                def ready(port):
                    print(json.dumps({'port': port}), flush=True)
                    os._exit(0)
                try:
                    server(QueryCache(), int(sys.argv[1]), local_only=True,
                           on_listen=ready, listen_attempts=int(sys.argv[2]),
                           log_startup_message=False)
                except OSError:
                    print(json.dumps({'failed': True}), flush=True)
                    os._exit(0)
            """),
                str(port),
                str(attempts),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode == 0, result.stderr
        value = json.loads(result.stdout)
        if attempts == 1:
            assert value == {"failed": True}
        else:
            assert value["port"] > 0 and value["port"] != port
