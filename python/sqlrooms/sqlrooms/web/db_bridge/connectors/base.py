from __future__ import annotations

from typing import Any, Iterable

from ..utils import cursor_columns, rows_to_arrow_bytes, rows_to_json_rows


class BaseSqlBridgeConnector:
    """
    Shared SQL execution helpers for bridge connectors.

    Subclasses provide `_connect()` and any engine-specific catalog/diagnostics logic.
    """

    def _connect(self):
        raise NotImplementedError

    def test_connection(self) -> bool:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return True

    def execute_query(self, sql: str, query_type: str) -> dict[str, Any]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                if query_type == "exec":
                    return {"ok": True}
                rows = cur.fetchall()
                columns = cursor_columns(cur)
                return {"jsonData": rows_to_json_rows(rows, columns)}

    def fetch_arrow_bytes(self, sql: str) -> bytes:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                columns = cursor_columns(cur)
                return rows_to_arrow_bytes(rows, columns)

    def stream_arrow_batches(
        self, sql: str, chunk_rows: int = 5000, query_id: str | None = None
    ) -> Iterable[bytes]:
        _ = query_id
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                columns = cursor_columns(cur)
                while True:
                    rows = cur.fetchmany(max(1, int(chunk_rows)))
                    if not rows:
                        break
                    yield rows_to_arrow_bytes(rows, columns)

    def cancel_query(self, query_id: str) -> bool:
        _ = query_id
        return False
