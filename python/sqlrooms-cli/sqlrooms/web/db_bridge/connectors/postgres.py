from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from typing import Any, Iterable

from ..utils import cursor_columns, rows_to_arrow_bytes, rows_to_json_rows


@dataclass(frozen=True)
class PostgresConnectorSettings:
    dsn: str
    connection_id: str = "postgres-default"
    title: str = "Postgres"


@dataclass(frozen=True)
class PostgresBridgeConnector:
    settings: PostgresConnectorSettings
    engine_id: str = "postgres"

    @property
    def connection_id(self) -> str:
        return self.settings.connection_id

    @property
    def title(self) -> str:
        return self.settings.title

    def _connect(self):
        try:
            import psycopg  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "Postgres bridge requires `psycopg`. Install it to enable Postgres."
            ) from exc
        return psycopg.connect(self.settings.dsn)

    def dependency_diagnostics(self) -> dict[str, Any]:
        available = importlib.util.find_spec("psycopg") is not None
        if available:
            return {"available": True}
        return {
            "available": False,
            "error": "Missing Python dependency: psycopg",
            "requiredPackages": ["psycopg[binary]>=3.2.0"],
            "installCommands": {
                "uvProject": "uv sync --extra postgres",
                "uvxRelaunch": (
                    'uvx --from "sqlrooms-cli[postgres]" sqlrooms '
                    "--db-path :memory:"
                ),
                "uvxWith": (
                    'uvx --from sqlrooms-cli --with "psycopg[binary]>=3.2.0" '
                    "sqlrooms --db-path :memory:"
                ),
            },
        }

    def test_connection(self) -> bool:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return True

    def list_catalog(self) -> dict[str, list[dict[str, Any]]]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database()")
                current_db = cur.fetchone()[0]
                cur.execute(
                    """
                    SELECT schema_name
                    FROM information_schema.schemata
                    ORDER BY schema_name
                    """
                )
                schemas = [
                    {"database": current_db, "schema": row[0]} for row in cur.fetchall()
                ]
                cur.execute(
                    """
                    SELECT table_schema, table_name, table_type
                    FROM information_schema.tables
                    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                    ORDER BY table_schema, table_name
                    """
                )
                tables = [
                    {
                        "database": current_db,
                        "schema": row[0],
                        "table": row[1],
                        "isView": str(row[2]).upper().endswith("VIEW"),
                    }
                    for row in cur.fetchall()
                ]
        return {
            "databases": [{"database": current_db}],
            "schemas": schemas,
            "tables": tables,
        }

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
