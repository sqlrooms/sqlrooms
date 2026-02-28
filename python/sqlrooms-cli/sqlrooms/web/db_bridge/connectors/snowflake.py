from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from typing import Any, Iterable

from ..utils import cursor_columns, quoted_ident, rows_to_arrow_bytes, rows_to_json_rows


@dataclass(frozen=True)
class SnowflakeConnectorSettings:
    account: str | None = None
    user: str | None = None
    password: str | None = None
    warehouse: str | None = None
    database: str | None = None
    schema: str | None = None
    role: str | None = None
    authenticator: str | None = None
    connection_id: str = "snowflake-default"
    title: str = "Snowflake"

    def is_enabled(self) -> bool:
        return bool(self.account and self.user)

    def to_connect_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {}
        for key in (
            "account",
            "user",
            "password",
            "warehouse",
            "database",
            "schema",
            "role",
            "authenticator",
        ):
            value = getattr(self, key)
            if value:
                kwargs[key] = value
        return kwargs


@dataclass(frozen=True)
class SnowflakeBridgeConnector:
    settings: SnowflakeConnectorSettings
    engine_id: str = "snowflake"

    @property
    def connection_id(self) -> str:
        return self.settings.connection_id

    @property
    def title(self) -> str:
        return self.settings.title

    def _connect(self):
        try:
            import snowflake.connector  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "Snowflake bridge requires `snowflake-connector-python`."
            ) from exc

        kwargs = self.settings.to_connect_kwargs()
        if not kwargs.get("account") or not kwargs.get("user"):
            raise RuntimeError(
                "Snowflake bridge requires both account and user configuration."
            )
        return snowflake.connector.connect(**kwargs)

    def dependency_diagnostics(self) -> dict[str, Any]:
        available = importlib.util.find_spec("snowflake.connector") is not None
        if available:
            return {"available": True}
        return {
            "available": False,
            "error": "Missing Python dependency: snowflake-connector-python",
            "requiredPackages": ["snowflake-connector-python>=4.3.0"],
            "installCommands": {
                "uvProject": "uv sync --extra snowflake",
                "uvxRelaunch": (
                    'uvx --from "sqlrooms-cli[snowflake]" sqlrooms '
                    "--db-path :memory:"
                ),
                "uvxWith": (
                    'uvx --from sqlrooms-cli --with '
                    '"snowflake-connector-python>=4.3.0" '
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
                cur.execute("SHOW DATABASES")
                db_rows = cur.fetchall()
                db_columns = cursor_columns(cur)
                databases: list[dict[str, Any]] = []
                for row in rows_to_json_rows(db_rows, db_columns):
                    normalized = {str(k).lower(): v for k, v in row.items()}
                    name = normalized.get("name") or normalized.get("database_name")
                    if name:
                        databases.append({"database": str(name)})

                current_db = self.settings.database
                if not current_db:
                    cur.execute("SELECT CURRENT_DATABASE()")
                    maybe_db = cur.fetchone()
                    if maybe_db and maybe_db[0]:
                        current_db = str(maybe_db[0])

                schemas: list[dict[str, Any]] = []
                tables: list[dict[str, Any]] = []

                if current_db:
                    db_ref = quoted_ident(current_db)
                    cur.execute(
                        f"""
                        SELECT SCHEMA_NAME
                        FROM {db_ref}.INFORMATION_SCHEMA.SCHEMATA
                        ORDER BY SCHEMA_NAME
                        """
                    )
                    schemas = [
                        {"database": current_db, "schema": row[0]}
                        for row in cur.fetchall()
                    ]
                    cur.execute(
                        f"""
                        SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
                        FROM {db_ref}.INFORMATION_SCHEMA.TABLES
                        ORDER BY TABLE_SCHEMA, TABLE_NAME
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

        return {"databases": databases, "schemas": schemas, "tables": tables}

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
