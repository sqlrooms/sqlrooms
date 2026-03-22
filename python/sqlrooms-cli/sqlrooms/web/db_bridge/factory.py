from __future__ import annotations

from .connectors import (
    PostgresBridgeConnector,
    PostgresConnectorSettings,
    SnowflakeBridgeConnector,
    SnowflakeConnectorSettings,
)
from .registry import DbBridgeRegistry

SUPPORTED_ENGINES: list[str] = ["postgres", "snowflake"]


def build_cli_db_bridge_registry(
    *,
    bridge_id: str,
    connector_settings: list[PostgresConnectorSettings | SnowflakeConnectorSettings]
    | None = None,
) -> DbBridgeRegistry:
    registry = DbBridgeRegistry(bridge_id=bridge_id)
    for settings in connector_settings or []:
        if isinstance(settings, PostgresConnectorSettings):
            registry.register(PostgresBridgeConnector(settings=settings))
            continue
        if isinstance(settings, SnowflakeConnectorSettings) and settings.is_enabled():
            registry.register(SnowflakeBridgeConnector(settings=settings))
    return registry
