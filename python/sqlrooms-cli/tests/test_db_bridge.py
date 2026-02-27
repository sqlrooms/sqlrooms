import pytest

from sqlrooms.web.db_bridge import (
    DbBridgeRegistry,
    SnowflakeConnectorSettings,
    UnknownBridgeConnectionError,
)


class _FakeConnector:
    connection_id = "fake-conn"
    engine_id = "fake"
    title = "Fake Connector"

    def test_connection(self) -> bool:
        return True

    def list_catalog(self):
        return {"databases": [{"database": "db"}], "schemas": [], "tables": []}

    def execute_query(self, sql: str, query_type: str):
        return {"jsonData": [{"sql": sql, "queryType": query_type}]}

    def fetch_arrow_base64(self, sql: str) -> str:
        return f"arrow:{sql}"

    def cancel_query(self, query_id: str) -> bool:
        return query_id == "known-query"


def test_registry_routes_to_registered_connector():
    registry = DbBridgeRegistry(bridge_id="bridge-id")
    registry.register(_FakeConnector())

    assert registry.has_connections() is True
    assert registry.has_engine("fake") is True
    assert registry.runtime_connections() == [
        {
            "id": "fake-conn",
            "engineId": "fake",
            "title": "Fake Connector",
            "runtimeSupport": "server",
            "requiresBridge": True,
            "bridgeId": "bridge-id",
            "isCore": False,
        }
    ]
    assert registry.test_connection("fake-conn") is True
    assert registry.list_catalog("fake-conn") == {
        "databases": [{"database": "db"}],
        "schemas": [],
        "tables": [],
    }
    assert registry.execute_query("fake-conn", "SELECT 1", "json") == {
        "jsonData": [{"sql": "SELECT 1", "queryType": "json"}]
    }
    assert registry.fetch_arrow_base64("fake-conn", "SELECT 1") == "arrow:SELECT 1"
    assert registry.cancel_query("fake-conn", "known-query") is True


def test_registry_raises_for_unknown_connection():
    registry = DbBridgeRegistry(bridge_id="bridge-id")
    with pytest.raises(UnknownBridgeConnectionError):
        registry.test_connection("unknown")


def test_snowflake_settings_requires_account_and_user():
    assert SnowflakeConnectorSettings(account="acc", user="user").is_enabled() is True
    assert SnowflakeConnectorSettings(account="acc", user=None).is_enabled() is False
    assert SnowflakeConnectorSettings(account=None, user="user").is_enabled() is False
