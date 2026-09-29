"""Load the generated browser contract from installed package resources."""

import hashlib
from importlib.resources import files
import json

CONTRACT = json.loads(files("sqlrooms").joinpath("mcp_tool_contract.json").read_text())
TOOL_VERSION = CONTRACT["version"]
TOOL_HASH = hashlib.sha256(
    json.dumps(CONTRACT, sort_keys=True, separators=(",", ":")).encode()
).hexdigest()
CONTROL_VERSION = 2


def matches_browser(tools):
    return isinstance(tools, list) and sorted(
        tools, key=lambda t: t.get("name", "")
    ) == sorted(CONTRACT["tools"], key=lambda t: t["name"])
