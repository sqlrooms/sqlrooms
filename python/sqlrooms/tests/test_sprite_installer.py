"""Exercise generated Sprite launch/readiness commands without deploying a Sprite."""

import json
import os
from pathlib import Path
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from sqlrooms.web.launcher import SqlroomsHttpServer


SCRIPT = (
    Path(__file__).resolve().parents[3] / "scripts/deploy-sqlrooms-cli-to-sprite.sh"
).read_text()


def test_generated_sprite_runner_uses_supported_bind_host(tmp_path):
    bin_dir = tmp_path / "venv/bin"
    bin_dir.mkdir(parents=True)
    executable = bin_dir / "sqlrooms"
    executable.write_text(
        f"#!{sys.executable}\nimport json, sys\nprint(json.dumps(sys.argv[1:]))\n"
    )
    executable.chmod(0o700)
    runner = SCRIPT.split('cat >"$APP_DIR/run-sqlrooms.sh" <<RUNNER\n', 1)[1].split(
        "\nRUNNER", 1
    )[0]
    env = {
        **os.environ,
        "APP_DIR": str(tmp_path),
        "DB_PATH": str(tmp_path / "test.duckdb"),
        "HTTP_PORT": "8080",
        "WS_PORT": "4000",
        "SQLROOMS_EXTERNAL_URL": "https://test.sprites.dev",
        "SQLROOMS_EXTERNAL_WS_URL": "wss://test.sprites.dev/ws/duckdb",
    }
    subprocess.run(
        ["bash", "-c", f'cat >"$APP_DIR/runner" <<RUNNER\n{runner}\nRUNNER'],
        env=env,
        check=True,
    )
    args = json.loads(
        subprocess.check_output(
            ["bash", str(tmp_path / "runner"), "--no-ui"], text=True
        )
    )
    assert args[-1] == "--no-ui"
    # Validate the generated host against the actual launcher's security boundary.
    server = SqlroomsHttpServer(
        tmp_path / "test.duckdb",
        args[args.index("--host") + 1],
        int(args[args.index("--port") + 1]),
        None,
        serve_ui=False,
    )
    assert server.host == "127.0.0.1"


def test_sprite_readiness_uses_public_health(tmp_path):
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            self.send_response(200 if self.path == "/healthz" else 401)
            self.end_headers()

        def log_message(self, *_args):
            pass

    with HTTPServer(("127.0.0.1", 0), Handler) as server:
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            readiness = SCRIPT.split('"$APP_DIR/venv/bin/python" - <<PY\n', 1)[1].split(
                "\nPY", 1
            )[0]
            readiness = (
                readiness.replace("$HTTP_PORT", str(server.server_port))
                .replace("$HEALTH_CHECK_TIMEOUT", "2")
                .replace("$HEALTH_CHECK_INTERVAL", "0.01")
            )
            subprocess.run([sys.executable, "-c", readiness], check=True, timeout=5)
            assert requests == ["/healthz"]
        finally:
            server.shutdown()
            thread.join()
