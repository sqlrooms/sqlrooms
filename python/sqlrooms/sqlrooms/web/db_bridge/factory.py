from __future__ import annotations

from typing import Any

from .connectors import (
    PostgresBridgeConnector,
    PostgresConnectorSettings,
    SnowflakeBridgeConnector,
    SnowflakeConnectorSettings,
)
from .connectors.base import BaseSqlBridgeConnector
from .registry import DbBridgeRegistry

SUPPORTED_ENGINES: list[str] = ["postgres", "snowflake"]

ENGINE_CONFIG_FIELDS: dict[str, list[dict[str, Any]]] = {
    "postgres": [
        {"key": "host", "label": "Host", "placeholder": "localhost", "required": True},
        {"key": "port", "label": "Port", "placeholder": "5432"},
        {
            "key": "database",
            "label": "Database",
            "placeholder": "my_db",
            "required": True,
        },
        {"key": "user", "label": "User", "placeholder": "postgres", "required": True},
        {"key": "password", "label": "Password", "placeholder": "", "secret": True},
    ],
    "snowflake": [
        {
            "key": "account",
            "label": "Account",
            "placeholder": "xy12345.us-east-1",
            "required": True,
        },
        {"key": "user", "label": "User", "placeholder": "my_user", "required": True},
        {"key": "password", "label": "Password", "placeholder": "", "secret": True},
        {"key": "warehouse", "label": "Warehouse", "placeholder": "COMPUTE_WH"},
        {"key": "database", "label": "Database", "placeholder": "MY_DB"},
        {"key": "schema", "label": "Schema", "placeholder": "PUBLIC"},
        {"key": "role", "label": "Role", "placeholder": "ACCOUNTADMIN"},
        {"key": "authenticator", "label": "Authenticator", "placeholder": "snowflake"},
    ],
}


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


def build_ephemeral_connector(
    engine: str,
    config: dict[str, str],
) -> BaseSqlBridgeConnector:
    """Create a throwaway connector from raw config for ad-hoc connection tests."""
    if engine == "postgres":
        return PostgresBridgeConnector(
            settings=PostgresConnectorSettings(
                host=config.get("host", "localhost"),
                port=config.get("port", "5432"),
                database=config.get("database", ""),
                user=config.get("user", ""),
                password=config.get("password"),
            )
        )
    if engine == "snowflake":
        return SnowflakeBridgeConnector(
            settings=SnowflakeConnectorSettings(
                account=config.get("account"),
                user=config.get("user"),
                password=config.get("password"),
                warehouse=config.get("warehouse"),
                database=config.get("database"),
                schema=config.get("schema"),
                role=config.get("role"),
                authenticator=config.get("authenticator"),
            )
        )
    raise ValueError(f"Unsupported engine: {engine!r}")
