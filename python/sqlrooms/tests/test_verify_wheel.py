from __future__ import annotations

import json
import runpy
from pathlib import Path

import pytest


PACKAGE_DIR = Path(__file__).resolve().parents[1]
VERIFY_WHEEL = runpy.run_path(str(PACKAGE_DIR / "scripts" / "verify_wheel.py"))
VERSION = json.loads((PACKAGE_DIR / "package.json").read_text())["version"]


@pytest.mark.parametrize("dist_dir", [Path("dist"), Path("../dist")])
def test_default_selection_ignores_other_versions(tmp_path, monkeypatch, dist_dir):
    package_dir = tmp_path / "sqlrooms"
    package_dir.mkdir()
    monkeypatch.chdir(package_dir)
    dist_dir.mkdir()
    current_wheel = dist_dir / f"sqlrooms-{VERSION}-py3-none-any.whl"
    current_wheel.touch()
    (dist_dir / "sqlrooms-0.0.0-py3-none-any.whl").touch()
    (dist_dir / f"sqlrooms-{VERSION}0-py3-none-any.whl").touch()
    (dist_dir / f"roomie-{VERSION}-py3-none-any.whl").touch()

    assert VERIFY_WHEEL["_resolve_wheels"]([]) == [current_wheel]


def test_missing_current_wheel_fails_with_stale_wheel_present(
    tmp_path, monkeypatch, capsys
):
    monkeypatch.chdir(tmp_path)
    Path("dist").mkdir()
    Path("dist/sqlrooms-0.0.0-py3-none-any.whl").touch()
    monkeypatch.setattr("sys.argv", ["verify_wheel.py"])

    assert VERIFY_WHEEL["main"]() == 1
    assert "No sqlrooms wheel found to verify." in capsys.readouterr().err


def test_explicit_paths_preserve_other_versions():
    wheel = Path("dist/sqlrooms-0.0.0-py3-none-any.whl")

    assert VERIFY_WHEEL["_resolve_wheels"]([str(wheel)]) == [wheel]
