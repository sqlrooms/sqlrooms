"""Verify Roomie's product-owned distribution without importing a source checkout."""

from pathlib import Path
import json
import zipfile


def verify(path):
    with zipfile.ZipFile(path) as wheel:
        names = wheel.namelist()
        for name in (
            "roomie/__main__.py",
            "roomie/cli.py",
            "roomie/server.py",
            "roomie/settings.py",
            "roomie/mcp_tool_contract.json",
            "roomie/capabilities.json",
            "roomie/static/index.html",
            "roomie/build.json",
            "roomie/NOTICE",
            "roomie/THIRD_PARTY_NOTICES.txt",
            "roomie/claude_plugin/.claude-plugin/plugin.json",
            "roomie/claude_plugin/skills/roomie/SKILL.md",
        ):
            assert name in names, f"Missing wheel file: {name}"
        assert not any(name.startswith("sqlrooms/") for name in names), (
            "Roomie must not own SQLRooms runtime files"
        )
        metadata = wheel.read(
            next(name for name in names if name.endswith(".dist-info/METADATA"))
        ).decode()
        assert "Requires-Dist: sqlrooms<0.2,>=0.1.6" in metadata
        entry_points = wheel.read(
            next(name for name in names if name.endswith(".dist-info/entry_points.txt"))
        ).decode()
        assert "roomie = roomie.cli:main" in entry_points
        contract = json.loads(wheel.read("roomie/mcp_tool_contract.json"))
        assert {tool["name"] for tool in contract["tools"]} == {
            "query",
            "list_tables",
            "read_table_schema",
            "search_commands",
            "get_command",
            "execute_command",
        }
        assert any(
            name.startswith("roomie/static/assets/") and name.endswith(".js")
            for name in names
        )
        assert any(
            name.startswith("roomie/static/assets/") and name.endswith(".css")
            for name in names
        )
    print(f"Verified {path.name}: {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    wheels = list((Path(__file__).resolve().parents[1] / "dist").glob("roomie-*.whl"))
    assert wheels, "Build the Roomie wheel first"
    for wheel in wheels:
        verify(wheel)
