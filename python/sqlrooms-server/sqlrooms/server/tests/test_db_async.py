import asyncio
import concurrent.futures

import pytest

from .. import db_async


def test_run_db_task_honors_cancel_requested_before_registration(tmp_path):
    db_path = tmp_path / "pending-cancel.duckdb"
    query_id = "pending-cancel-query"
    executed = False

    db_async.init_global_connection(str(db_path), extensions=[])
    try:
        assert db_async.cancel_query(query_id) is False

        def _run(_cur):
            nonlocal executed
            executed = True

        with pytest.raises(concurrent.futures.CancelledError):
            asyncio.run(db_async.run_db_task(_run, query_id=query_id))

        assert executed is False
    finally:
        db_async.cancel_all_queries()
        db_async.force_checkpoint_and_close()
