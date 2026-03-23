from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from typing import Any

from .base import BaseSqlBridgeConnector


@dataclass(frozen=True)
class PostgresConnectorSettings:
    connection_id: str = "postgres-default"
    title: str = "Postgres"
    host: str = "localhost"
    port: str = "5432"
    database: str = ""
    user: str = ""
    password: str | None = None

    def resolve_dsn(self) -> str:
        pw = f":{self.password}" if self.password else ""
        return f"postgresql://{self.user}{pw}@{self.host}:{self.port}/{self.database}"


@dataclass(frozen=True)
class PostgresBridgeConnector(BaseSqlBridgeConnector):
    settings: PostgresConnectorSettings
    engine_id: str = "postgres"

    @property
    def connection_id(self) -> str:
        return self.settings.connection_id

    @property
    def title(self) -> str:
        return self.settings.title

    def config_dict(self) -> dict[str, Any]:
        s = self.settings
        d: dict[str, Any] = {}
        for k in ("host", "port", "database", "user", "password"):
            v = getattr(s, k)
            if v:
                d[k] = v
        return d

    def _connect(self):
        try:
            import psycopg  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "Postgres bridge requires `psycopg`. Install it to enable Postgres."
            ) from exc
        return psycopg.connect(self.settings.resolve_dsn())

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

    def list_catalog(self) -> dict[str, list[dict[str, Any]]]:
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database()")
                result = cur.fetchone()
                if result is None:
                    raise RuntimeError(
                        "Postgres bridge could not resolve current database."
                    )
                current_db = result[0]
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

