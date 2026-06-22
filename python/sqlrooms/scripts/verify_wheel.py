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

    index_path = "sqlrooms/web/static/index.html"
    if index_path not in names:
        raise RuntimeError(f"{path} is missing {index_path}")

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
