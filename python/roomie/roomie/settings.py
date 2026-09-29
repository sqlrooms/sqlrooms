"""Roomie-owned identity and fixed generated capability contract."""

from importlib.resources import files
import json
from sqlrooms.agent.settings import ApplicationSettings


def settings() -> ApplicationSettings:
    """Return an isolated Roomie lifecycle composition."""
    return ApplicationSettings(
        product="roomie",
        name="Roomie",
        environment_prefix="ROOMIE",
        profiles=(),
        default_new_profile=None,
        contract=json.loads(
            files("roomie").joinpath("mcp_tool_contract.json").read_text()
        ),
    )
