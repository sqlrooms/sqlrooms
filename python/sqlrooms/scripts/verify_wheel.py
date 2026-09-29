from __future__ import annotations

import sys
from pathlib import Path
from zipfile import ZipFile


def _resolve_wheels(args: list[str]) -> list[Path]:
    if args:
        wheels = [Path(arg) for arg in args]
    else:
        candidate_dirs = [Path("dist"), Path("..") / "dist"]
        wheels = [
            wheel
            for candidate_dir in candidate_dirs
            for wheel in sorted(candidate_dir.glob("sqlrooms-*.whl"))
        ]
    return [wheel for wheel in wheels if wheel.name.startswith("sqlrooms-")]


def _verify_wheel(path: Path) -> None:
    if not path.exists():
        raise RuntimeError(f"Wheel not found: {path}")

    with ZipFile(path) as wheel:
        names = set(wheel.namelist())

    for module in ("runtime.py", "app.py", "transport.py", "protocol.py", "access.py"):
        if f"sqlrooms/server/{module}" not in names:
            raise RuntimeError(f"{path} is missing consolidated runtime {module}")
    with ZipFile(path) as wheel:
        metadata = wheel.read(
            next(name for name in names if name.endswith(".dist-info/METADATA"))
        ).decode()
        entries = wheel.read(
            next(name for name in names if name.endswith(".dist-info/entry_points.txt"))
        ).decode()
        if (
            "Requires-Dist: sqlrooms-server" in metadata
            or "Requires-Dist: socketify" in metadata
        ):
            raise RuntimeError(f"{path} still depends on the standalone runtime")
        if "sqlrooms-server" in entries or "sqlrooms-duckdb-server" in entries:
            raise RuntimeError(f"{path} contains stale console aliases")

    if (
        "sqlrooms/mcp_tool_contract.json" not in names
        or "sqlrooms/__main__.py" not in names
    ):
        raise RuntimeError(
            f"{path} is missing the managed connector contract or module entrypoint"
        )

    index_path = "sqlrooms/web/static/index.html"
    if index_path not in names:
        raise RuntimeError(f"{path} is missing {index_path}")

    for plugin_file in (
        ".claude-plugin/plugin.json",
        "mcp.json",
        "headers.mjs",
        "skills/sqlrooms/SKILL.md",
        "skills/sqlrooms/references/documents.md",
        "skills/sqlrooms/references/charts.md",
        "skills/sqlrooms/references/maps.md",
    ):
        if f"sqlrooms/claude_plugin/{plugin_file}" not in names:
            raise RuntimeError(f"{path} is missing Claude plugin file {plugin_file}")

    for auth_module in ("sqlrooms/web/security.py", "sqlrooms/web/native_headers.py"):
        if auth_module not in names:
            raise RuntimeError(f"{path} is missing {auth_module}")

    asset_paths = [
        name for name in names if name.startswith("sqlrooms/web/static/assets/")
    ]
    if not any(name.endswith(".js") for name in asset_paths):
        raise RuntimeError(f"{path} is missing bundled JavaScript assets")
    if not any(name.endswith(".css") for name in asset_paths):
        raise RuntimeError(f"{path} is missing bundled CSS assets")

    development_paths = [
        name
        for name in names
        if name.startswith("apps/")
        or name.startswith("node_modules/")
        or "apps/sqlrooms-cli-ui/dist" in name
    ]
    if development_paths:
        sample = ", ".join(development_paths[:3])
        raise RuntimeError(f"{path} contains development-only paths: {sample}")

    print(f"Verified bundled SQLRooms UI in {path}")


def main() -> int:
    wheels = _resolve_wheels(sys.argv[1:])
    if not wheels:
        print("No sqlrooms wheel found to verify.", file=sys.stderr)
        return 1

    try:
        for wheel in wheels:
            _verify_wheel(wheel)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
