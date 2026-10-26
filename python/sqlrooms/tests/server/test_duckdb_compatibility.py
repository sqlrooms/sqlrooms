"""Released engine contracts, using only disposable files and copied workspaces."""

import json
import os
import shutil
import subprocess
from datetime import datetime
from decimal import Decimal

import duckdb
import pyarrow as pa
import pytest
from sqlrooms.server.query import get_arrow, get_arrow_bytes, get_json
from sqlrooms.server.runtime import DuckDBRuntime
from sqlrooms.server.crdt.state import CrdtState


def test_arrow_values_round_trip():
    with duckdb.connect() as con:
        data = get_arrow_bytes(
            con,
            """
            SELECT NULL::INTEGER AS n, 12.34::DECIMAL(9,2) AS d,
              TIMESTAMP '2026-01-01 12:34:56.123456' AS t,
              {'items': [1, NULL]} AS nested
        """,
        )
        row = pa.ipc.open_stream(data).read_all().to_pylist()[0]
        assert row == {
            "n": None,
            "d": Decimal("12.34"),
            "t": datetime(2026, 1, 1, 12, 34, 56, 123456),
            "nested": {"items": [1, None]},
        }
        # The legacy JSON endpoint uses pandas: timestamps are milliseconds.
        assert json.loads(
            get_json(con, "SELECT NULL::INTEGER AS n, {'items':[1,NULL]} AS s")
        ) == [{"n": None, "s": {"items": [1, None]}}]


@pytest.mark.parametrize(
    "value",
    ["42::VARIANT", "[42::VARIANT]", "{'x':42::VARIANT}", "MAP {'x':42::VARIANT}"],
)
def test_variant_requires_explicit_cast_for_browser_arrow(value):
    with duckdb.connect() as con:
        with pytest.raises(ValueError, match="Cast VARIANT values to JSON"):
            get_arrow(con, f"SELECT {value} AS v")
        # A failed conversion must not leave an open/aborted transaction.
        assert get_arrow(con, "SELECT 42 AS value").to_pylist() == [{"value": 42}]
        assert get_arrow(
            con, "SELECT {'items':[1,NULL]}::VARIANT::JSON AS v"
        ).to_pylist() == [{"v": '{"items":[1,null]}'}]


def test_migration_sql_contracts():
    with duckdb.connect() as con:
        assert con.execute(
            "SELECT list_transform([1,2], lambda x: x+1)"
        ).fetchone() == ([2, 3],)
        with pytest.raises(duckdb.Error):
            con.execute("SELECT list_transform([1,2], x -> x+1)")
        for expression in ["1 // 0", "1 % 0"]:
            with pytest.raises(duckdb.Error, match="Division by zero"):
                con.execute(f"SELECT {expression}")
            assert con.execute(f"SELECT TRY({expression})").fetchone() == (None,)
        assert con.execute('SELECT 1 AS "Mixed Case"').description[0][0] == "Mixed Case"


@pytest.mark.asyncio
async def test_local_imports_and_metadata_reopen(tmp_path):
    csv = tmp_path / "local 'data.csv"
    csv.write_text("id,label\n1,one\n2,two\n")
    source = tmp_path / "local.json"
    source.write_text('[{"id":3,"label":"three"}]')
    parquet = tmp_path / "local.parquet"
    runtime = DuckDBRuntime(str(tmp_path / "workspace.duckdb"), tmp_path, extensions=[])
    await runtime.start()
    try:

        def imports(con):
            con.execute(
                "CREATE TABLE csv_data AS SELECT * FROM read_csv(?)", [str(csv)]
            )
            con.execute(
                "CREATE TABLE json_data AS SELECT * FROM read_json(?)", [str(source)]
            )
            con.execute("COPY csv_data TO ? (FORMAT PARQUET)", [str(parquet)])
            con.execute(
                "CREATE TABLE parquet_data AS SELECT * FROM read_parquet(?)",
                [str(parquet)],
            )
            con.execute(
                "INSERT INTO __sqlrooms.ui_state(key,payload_json) VALUES ('default', ?)",
                ['{"document":{"blocks":[]}}'],
            )
            return con.execute("SELECT count(*) FROM parquet_data").fetchone()

        assert await runtime.run_db_task(imports) == (2,)
        await runtime.save_crdt_snapshot("room", b"snapshot")
    finally:
        await runtime.close()
    with duckdb.connect(runtime.database_path) as con:
        assert con.execute("SELECT * FROM json_data").fetchall() == [(3, "three")]
        assert json.loads(
            con.execute("SELECT payload_json FROM __sqlrooms.ui_state").fetchone()[0]
        ) == {"document": {"blocks": []}}
        assert con.execute("SELECT snapshot FROM __sqlrooms.sync_rooms").fetchone() == (
            b"snapshot",
        )


@pytest.mark.asyncio
async def test_sync_snapshot_hydrates_after_runtime_restart(tmp_path):
    path = str(tmp_path / "sync.duckdb")
    for iteration in range(2):
        runtime = DuckDBRuntime(path, tmp_path, extensions=[])
        await runtime.start()
        sync = CrdtState(runtime)
        try:
            room = await sync.ensure_loaded("compatibility")
            if iteration == 0:
                room.doc.get_map("data").insert("value", "saved")
                room.doc.commit()
                room.dirty = True
            else:
                assert room.doc.get_map("data").get_deep_value() == {"value": "saved"}
        finally:
            await sync.close()
            await runtime.close()


@pytest.mark.asyncio
async def test_storage_policy_with_older_reader(tmp_path):
    older_python = os.environ.get("DUCKDB_COMPAT_PYTHON")
    if not older_python:
        pytest.skip("Set DUCKDB_COMPAT_PYTHON to an isolated DuckDB 1.4/1.5 Python")

    def older(code, *args, check=True):
        return subprocess.run(
            [older_python, "-c", code, *map(str, args)],
            check=check,
            capture_output=True,
            text=True,
        )

    reader_version = older("import duckdb; print(duckdb.__version__)").stdout.strip()
    assert reader_version.startswith(("1.4.", "1.5.")), (
        f"DUCKDB_COMPAT_PYTHON must use DuckDB 1.4/1.5, got {reader_version}"
    )

    original = tmp_path / "original.duckdb"
    older(
        "import duckdb,sys; c=duckdb.connect(sys.argv[1]); c.execute('CREATE TABLE saved AS SELECT 42 AS value'); c.close()",
        original,
    )
    copy = tmp_path / "copy.duckdb"
    shutil.copy2(original, copy)
    original_bytes = original.read_bytes()
    new = tmp_path / "new.duckdb"
    attached = tmp_path / "metadata.duckdb"
    for path in [copy, new]:
        runtime = DuckDBRuntime(
            str(path),
            tmp_path,
            extensions=[],
            meta_namespace="meta",
            meta_db_path=str(attached) if path == new else None,
        )
        await runtime.start()
        try:
            await runtime.run_db_task(
                lambda con: con.execute("CREATE TABLE added AS SELECT 7 AS value")
            )
        finally:
            await runtime.close()
        older(
            "import duckdb,sys; c=duckdb.connect(sys.argv[1]); assert c.execute('SELECT value FROM added').fetchone()==(7,); c.close()",
            path,
        )
    assert original.read_bytes() == original_bytes
    older(
        "import duckdb,sys; c=duckdb.connect(sys.argv[1]); assert c.execute('SELECT count(*) FROM ui_state').fetchone()==(0,); c.close()",
        attached,
    )
    native = tmp_path / "native-2.duckdb"
    with duckdb.connect(str(native)) as con:
        con.execute("CREATE TABLE t AS SELECT 1 AS value")
    # The compatibility setting must not silently downgrade an existing 2.0 file.
    runtime = DuckDBRuntime(str(native), tmp_path, extensions=[])
    await runtime.start()
    await runtime.close()
    rejected = older(
        "import duckdb,sys; duckdb.connect(sys.argv[1])", native, check=False
    )
    assert rejected.returncode != 0
    assert "version" in rejected.stderr.lower()
