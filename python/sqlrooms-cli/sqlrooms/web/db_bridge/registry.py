from __future__ import annotations

from typing import Any

from .types import DbBridgeConnector


class UnknownBridgeConnectionError(KeyError):
    """Raised when a bridge request references an unknown connection id."""


class DbBridgeRegistry:
    def __init__(self, *, bridge_id: str):
        self.bridge_id = bridge_id
        self._connectors: dict[str, DbBridgeConnector] = {}

    def register(self, connector: DbBridgeConnector) -> None:
        if connector.connection_id in self._connectors:
            raise ValueError(
                f"Duplicate DB bridge connection id: {connector.connection_id}"
            )
        self._connectors[connector.connection_id] = connector

    def has_connections(self) -> bool:
        return bool(self._connectors)

    def has_engine(self, engine_id: str) -> bool:
        return any(conn.engine_id == engine_id for conn in self._connectors.values())

    def runtime_connections(self) -> list[dict[str, Any]]:
        result = []
        for conn in self._connectors.values():
            entry: dict[str, Any] = {
                "id": conn.connection_id,
                "engineId": conn.engine_id,
                "title": conn.title,
                "runtimeSupport": "server",
                "requiresBridge": True,
                "bridgeId": self.bridge_id,
                "isCore": False,
            }
            cfg = conn.config_dict()
            if cfg:
                entry["config"] = cfg
            result.append(entry)
        return result

    def runtime_diagnostics(self) -> list[dict[str, Any]]:
        diagnostics: list[dict[str, Any]] = []
        for conn in self._connectors.values():
            payload = conn.dependency_diagnostics()
            payload["id"] = conn.connection_id
            payload["engineId"] = conn.engine_id
            payload["title"] = conn.title
            diagnostics.append(payload)
        return diagnostics

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

    def fetch_arrow_bytes(self, connection_id: str, sql: str) -> bytes:
        return self._get_connector(connection_id).fetch_arrow_bytes(sql)

    def stream_arrow_batches(
        self,
        connection_id: str,
        sql: str,
        *,
        chunk_rows: int = 5000,
        query_id: str | None = None,
    ):
        return self._get_connector(connection_id).stream_arrow_batches(
            sql, chunk_rows=chunk_rows, query_id=query_id
        )

    def cancel_query(self, connection_id: str, query_id: str) -> bool:
        return self._get_connector(connection_id).cancel_query(query_id)

    def _get_connector(self, connection_id: str) -> DbBridgeConnector:
        connector = self._connectors.get(connection_id)
        if connector is None:
            raise UnknownBridgeConnectionError(
                f"Unknown DB bridge connection: {connection_id}"
            )
        return connector
