from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Protocol

import pyarrow as pa

logger = logging.getLogger(__name__)


class UnknownBridgeConnectionError(KeyError):
    """Raised when a bridge request references an unknown connection id."""


class DbBridgeConnector(Protocol):
    connection_id: str
    engine_id: str
    title: str

    def test_connection(self) -> bool: ...

    def list_catalog(self) -> dict[str, list[dict[str, Any]]]: ...

    def execute_query(self, sql: str, query_type: str) -> dict[str, Any]: ...

    def fetch_arrow_base64(self, sql: str) -> str: ...

    def cancel_query(self, query_id: str) -> bool: ...


def _cursor_columns(cursor: Any) -> list[str]:
    description = getattr(cursor, "description", None) or []
    columns: list[str] = []
    for item in description:
        if hasattr(item, "name"):
            columns.append(str(item.name))
        elif isinstance(item, (list, tuple)) and item:
            columns.append(str(item[0]))
    return columns


def _rows_to_json_rows(
    rows: Iterable[Iterable[Any]],
    columns: list[str],
) -> list[dict[str, Any]]:
    return [dict(zip(columns, row)) for row in rows]


def _rows_to_arrow_base64(
    rows: Iterable[Iterable[Any]],
    columns: list[str],
) -> str:
    json_rows = _rows_to_json_rows(rows, columns)
    if json_rows:
        table = pa.Table.from_pylist(json_rows)
    elif columns:
        table = pa.table({column: pa.array([], type=pa.null()) for column in columns})
    else:
        table = pa.table({})

    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return base64.b64encode(sink.getvalue().to_pybytes()).decode("ascii")


def _quoted_ident(ident: str) -> str:
    return '"' + ident.replace('"', '""') + '"'


class DbBridgeRegistry:
    def __init__(self, *, bridge_id: str):
        self.bridge_id = bridge_id
        self._connectors: Dict[str, DbBridgeConnector] = {}

    def register(self, connector: DbBridgeConnector) -> None:
        self._connectors[connector.connection_id] = connector

    def has_connections(self) -> bool:
        return bool(self._connectors)

    def has_engine(self, engine_id: str) -> bool:
        return any(conn.engine_id == engine_id for conn in self._connectors.values())

    def runtime_connections(self) -> list[dict[str, Any]]:
        return [
            {
                "id": conn.connection_id,
                "engineId": conn.engine_id,
                "title": conn.title,
                "runtimeSupport": "server",
                "requiresBridge": True,
                "bridgeId": self.bridge_id,
                "isCore": False,
            }
            for conn in self._connectors.values()
        ]

    def test_connection(self, connection_id: str) -> bool:
        return self._get_connector(connection_id).test_connection()

    def list_catalog(self, connection_id: str) -> dict[str, list[dict[str, Any]]]:
        return self._get_connector(connection_id).list_catalog()

    def execute_query(
        self,
        connection_id: str,
        sql: str,
        query_type: str,
    ) -> dict[str, Any]:
        return self._get_connector(connection_id).execute_query(sql, query_type)

    def fetch_arrow_base64(self, connection_id: str, sql: str) -> str:
        return self._get_connector(connection_id).fetch_arrow_base64(sql)

    def cancel_query(self, connection_id: str, query_id: str) -> bool:
        return self._get_connector(connection_id).cancel_query(query_id)

    def _get_connector(self, connection_id: str) -> DbBridgeConnector:
        connector = self._connectors.get(connection_id)
        if connector is None:
            raise UnknownBridgeConnectionError(
                f"Unknown DB bridge connection: {connection_id}"
            )
        return connector


@dataclass(frozen=True)
class PostgresBridgeConnector:
    dsn: str
    connection_id: str = "postgres-default"
    title: str = "Postgres"
    engine_id: str = "postgres"

    def _connect(self):
        try:
            import psycopg  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "Postgres bridge requires `psycopg`. Install it to enable Postgres."
            ) from exc
        return psycopg.connect(self.dsn)

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
                columns = _cursor_columns(cur)
                return {"jsonData": _rows_to_json_rows(rows, columns)}

    def fetch_arrow_base64(self, sql: str) -> str:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                columns = _cursor_columns(cur)
                return _rows_to_arrow_base64(rows, columns)

    def cancel_query(self, query_id: str) -> bool:
        _ = query_id
        return False


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
                db_columns = _cursor_columns(cur)
                databases: list[dict[str, Any]] = []
                for row in _rows_to_json_rows(db_rows, db_columns):
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
                    db_ref = _quoted_ident(current_db)
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
                columns = _cursor_columns(cur)
                return {"jsonData": _rows_to_json_rows(rows, columns)}

    def fetch_arrow_base64(self, sql: str) -> str:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = cur.fetchall()
                columns = _cursor_columns(cur)
                return _rows_to_arrow_base64(rows, columns)

    def cancel_query(self, query_id: str) -> bool:
        _ = query_id
        return False


def build_cli_db_bridge_registry(
    *,
    bridge_id: str,
    postgres_dsn: str | None = None,
    postgres_connection_id: str = "postgres-default",
    postgres_title: str = "Postgres",
    snowflake_settings: SnowflakeConnectorSettings | None = None,
) -> DbBridgeRegistry:
    registry = DbBridgeRegistry(bridge_id=bridge_id)
    if postgres_dsn:
        registry.register(
            PostgresBridgeConnector(
                dsn=postgres_dsn,
                connection_id=postgres_connection_id,
                title=postgres_title,
            )
        )
    if snowflake_settings and snowflake_settings.is_enabled():
        registry.register(SnowflakeBridgeConnector(settings=snowflake_settings))
    return registry
