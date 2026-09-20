"""Verify isolated wheel/sdist installs and optional legacy two-wheel migration.

Usage: python verify_distribution.py <wheel> <sdist> [<old-cli-wheel> <old-server-wheel>]
Requires uv on PATH. Creates only temporary environments; never publishes.
"""

from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

from verify_wheel import _verify_wheel

SMOKE = """
from importlib import metadata
from pathlib import Path
import json
from fastapi.testclient import TestClient
from sqlrooms.web.launcher import SqlroomsHttpServer
import sqlrooms.server.runtime as module
assert Path(module.__file__).resolve().is_relative_to(Path(__import__('sys').prefix).resolve())
assert 'sqlrooms-server' not in {d.metadata['Name'].lower() for d in metadata.distributions()}
assert 'socketify' not in {d.metadata['Name'].lower() for d in metadata.distributions()}
assert not any('sqlrooms-server' in requirement for requirement in metadata.requires('sqlrooms'))
server = SqlroomsHttpServer('saved.duckdb','127.0.0.1', 3000, open_browser=False)
server.runtime.extensions=[]
server._assert_ui_available()
with TestClient(server._build_app(),base_url=server._ui_url(), headers={"Host":"127.0.0.1:3000"}) as client:
    assert client.get('/').status_code == 200
    with client.websocket_connect('/ws/duckdb') as ws:
        ws.send_json({'type':'auth','token':server.session_token})
        assert ws.receive_json()['type']=='authAck'
        ws.send_json({'type':'exec','sql':'CREATE OR REPLACE TABLE smoke AS SELECT 42 AS answer','queryId':'save'})
        assert ws.receive_json()=={'type':'ok','queryId':'save'}
import duckdb
with duckdb.connect('saved.duckdb') as db:
    assert db.execute('SELECT answer FROM smoke').fetchone()==(42,)
assert not (Path(__import__('sys').executable).parent/'sqlrooms-server').exists()
assert not (Path(__import__('sys').executable).parent/'sqlrooms-duckdb-server').exists()
print('Installed runtime, bundled UI, authenticated query and persistent reopen verified')
"""


def run(*args, cwd):
    subprocess.run(list(map(str, args)), cwd=cwd, check=True)


def main():
    wheel, sdist, *old = [Path(arg).resolve() for arg in sys.argv[1:]]
    _verify_wheel(wheel)
    with tempfile.TemporaryDirectory(prefix="sqlrooms-distribution-") as directory:
        root = Path(directory)
        with tarfile.open(sdist) as archive:
            archive.extractall(root / "source", filter="data")
        source = next((root / "source").iterdir())
        run("uv", "build", "--wheel", "--out-dir", root / "rebuilt", cwd=source)
        rebuilt = next((root / "rebuilt").glob("*.whl"))
        _verify_wheel(rebuilt)
        for label, artifact in [("wheel", wheel), ("sdist", rebuilt)]:
            env = root / label
            run("uv", "venv", env, cwd=root)
            python = env / "bin/python"
            run("uv", "pip", "install", "--python", python, artifact, cwd=root)
            run(python, "-I", "-c", SMOKE, cwd=root)
            run(python, "-I", "-m", "sqlrooms", "--version", cwd=root)
            run(python, "-I", "-m", "sqlrooms", "server", "--help", cwd=root)
        if old:
            if len(old) != 2:
                raise ValueError("Supply both old distribution wheels")
            env = root / "upgrade"
            run("uv", "venv", env, cwd=root)
            python = env / "bin/python"
            run("uv", "pip", "install", "--python", python, *old, cwd=root)
            run(
                python,
                "-I",
                "-c",
                "from importlib.metadata import version; assert version('sqlrooms-server'); import sqlrooms.server.server",
                cwd=root,
            )
            # Exactly the documented order; old transitive packages are removed
            # here to verify the final environment needs none of the old stack.
            run(
                "uv",
                "pip",
                "uninstall",
                "--python",
                python,
                "sqlrooms",
                "sqlrooms-server",
                "socketify",
                "ujson",
                cwd=root,
            )
            run("uv", "pip", "install", "--python", python, wheel, cwd=root)
            run(python, "-I", "-c", SMOKE, cwd=root)
    print("Distribution verification passed")


if __name__ == "__main__":
    main()
