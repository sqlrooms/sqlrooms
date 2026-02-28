from __future__ import annotations

from typing import Any, Iterable, Protocol


class DbBridgeConnector(Protocol):
    connection_id: str
    engine_id: str
    title: str

    def test_connection(self) -> bool: ...

    def list_catalog(self) -> dict[str, list[dict[str, Any]]]: ...

    def execute_query(self, sql: str, query_type: str) -> dict[str, Any]: ...

    def fetch_arrow_bytes(self, sql: str) -> bytes: ...

    def stream_arrow_batches(
        self, sql: str, chunk_rows: int = 5000, query_id: str | None = None
    ) -> Iterable[bytes]: ...

    def cancel_query(self, query_id: str) -> bool: ...

    def dependency_diagnostics(self) -> dict[str, Any]: ...
