"""Real Python launcher and bridge for the shared HTTP conformance runner."""
import json
from pathlib import Path
import socket
import sys

import uvicorn
from sqlrooms.web.launcher import SqlroomsHttpServer
from sqlrooms.server.security import CredentialFile

workspace = Path(sys.argv[1])
sock = socket.socket()
sock.bind(("127.0.0.1", 0))
port = sock.getsockname()[1]
url = f"http://127.0.0.1:{port}"
host = SqlroomsHttpServer(
    workspace / "python.duckdb", "127.0.0.1", port,
    open_browser=False, mcp_enabled=True, config_path=workspace / "config.toml",
)
credential = CredentialFile(host.access, url, f"{url}/mcp", f"ws://127.0.0.1:{port}/ws/mcp-bridge")
try:
    print(json.dumps({"url": url, "credentialPath": str(credential.path)}), flush=True)
    uvicorn.Server(uvicorn.Config(host._build_app(), log_level="error")).run(sockets=[sock])
finally:
    host.access.invalidate()
    credential.close()
    sock.close()
