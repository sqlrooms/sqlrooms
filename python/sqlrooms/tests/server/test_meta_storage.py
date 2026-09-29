import json
import asyncio


from sqlrooms.server.runtime import DuckDBRuntime


def _query_one_sync(runtime, sql: str):
    def _run(cur):
        return cur.execute(sql).fetchone()

    return asyncio.run(runtime.run_db_task(_run))


def test_meta_storage_main_db(tmp_path):
    db_path = tmp_path / "main.db"
    runtime = DuckDBRuntime(str(db_path), tmp_path, extensions=[])
    asyncio.run(runtime.start())
    try:
        _query_one_sync(
            runtime,
            """
            INSERT OR REPLACE INTO __sqlrooms.ui_state(key, payload_json, updated_at)
            VALUES ('default', CAST('{"ok": true}' AS JSON), now())
            """,
        )
        row = _query_one_sync(
            runtime,
            "SELECT payload_json FROM __sqlrooms.ui_state WHERE key='default' LIMIT 1",
        )
        assert row is not None
        payload = row[0]
        if isinstance(payload, str):
            payload = json.loads(payload)
        assert payload == {"ok": True}

        asyncio.run(runtime.save_crdt_snapshot("room1", b"\x01\x02\x03"))
        loaded = asyncio.run(runtime.load_crdt_snapshot("room1"))
        assert loaded == b"\x01\x02\x03"
    finally:
        asyncio.run(runtime.close())


def test_meta_storage_attached_db(tmp_path):
    main_db = tmp_path / "main.db"
    meta_db = tmp_path / "meta.db"
    runtime = DuckDBRuntime(
        str(main_db),
        tmp_path,
        extensions=[],
        meta_namespace="meta",
        meta_db_path=str(meta_db),
    )
    asyncio.run(runtime.start())
    try:
        _query_one_sync(
            runtime,
            """
            INSERT OR REPLACE INTO meta.ui_state(key, payload_json, updated_at)
            VALUES ('default', CAST('{"mode": "attached"}' AS JSON), now())
            """,
        )
        row = _query_one_sync(
            runtime,
            "SELECT payload_json FROM meta.ui_state WHERE key='default' LIMIT 1",
        )
        assert row is not None
        payload = row[0]
        if isinstance(payload, str):
            payload = json.loads(payload)
        assert payload == {"mode": "attached"}

        asyncio.run(runtime.save_crdt_snapshot("room2", b"\xaa\xbb"))
        loaded = asyncio.run(runtime.load_crdt_snapshot("room2"))
        assert loaded == b"\xaa\xbb"

        # Ensure it really went to the attached namespace.
        row2 = _query_one_sync(
            runtime,
            "SELECT snapshot FROM meta.sync_rooms WHERE room_id='room2' LIMIT 1",
        )
        assert row2 is not None and row2[0] == b"\xaa\xbb"
    finally:
        asyncio.run(runtime.close())
