import json
import asyncio


from .. import db_async


def _query_one_sync(sql: str):
    def _run(cur):
        return cur.execute(sql).fetchone()

    return asyncio.run(db_async.run_db_task(_run))


def test_meta_storage_main_db(tmp_path):
    db_path = tmp_path / "main.db"
    db_async.init_global_connection(str(db_path), extensions=[])
    try:
        db_async.init_meta_storage(namespace="__sqlrooms", attached_db_path=None)

        _query_one_sync(
            """
            INSERT OR REPLACE INTO __sqlrooms.ui_state(key, payload_json, updated_at)
            VALUES ('default', CAST('{"ok": true}' AS JSON), now())
            """
        )
        row = _query_one_sync(
            "SELECT payload_json FROM __sqlrooms.ui_state WHERE key='default' LIMIT 1"
        )
        assert row is not None
        payload = row[0]
        if isinstance(payload, str):
            payload = json.loads(payload)
        assert payload == {"ok": True}

        asyncio.run(db_async.save_crdt_snapshot("room1", b"\x01\x02\x03"))
        loaded = asyncio.run(db_async.load_crdt_snapshot("room1"))
        assert loaded == b"\x01\x02\x03"
    finally:
        db_async.force_checkpoint_and_close()


def test_meta_storage_attached_db(tmp_path):
    main_db = tmp_path / "main.db"
    meta_db = tmp_path / "meta.db"
    db_async.init_global_connection(str(main_db), extensions=[])
    try:
        db_async.init_meta_storage(namespace="meta", attached_db_path=str(meta_db))

        _query_one_sync(
            """
            INSERT OR REPLACE INTO meta.ui_state(key, payload_json, updated_at)
            VALUES ('default', CAST('{"mode": "attached"}' AS JSON), now())
            """
        )
        row = _query_one_sync(
            "SELECT payload_json FROM meta.ui_state WHERE key='default' LIMIT 1"
        )
        assert row is not None
        payload = row[0]
        if isinstance(payload, str):
            payload = json.loads(payload)
        assert payload == {"mode": "attached"}

        asyncio.run(db_async.save_crdt_snapshot("room2", b"\xaa\xbb"))
        loaded = asyncio.run(db_async.load_crdt_snapshot("room2"))
        assert loaded == b"\xaa\xbb"

        # Ensure it really went to the attached namespace.
        row2 = _query_one_sync(
            "SELECT snapshot FROM meta.sync_rooms WHERE room_id='room2' LIMIT 1"
        )
        assert row2 is not None and row2[0] == b"\xaa\xbb"
    finally:
        db_async.force_checkpoint_and_close()
