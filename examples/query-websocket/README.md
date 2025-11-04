# SQLRooms Query Workbench – WebSocket backend

This example uses the WebSocket DuckDB connector and must run alongside the Python server in `server/sqlrooms-duckdb-server`. By default, the client connects to `ws://localhost:4000`.

## Start the DuckDB server

Recommended (using uv):

```bash
cd server/sqlrooms-duckdb-server
uv run sqlrooms-duckdb-server
```

Or install and run via pip:

```bash
pip install sqlrooms-duckdb-server
sqlrooms-duckdb-server
```

Notes:

- If you enable auth, add `--auth-token YOUR_TOKEN` when starting the server. The client must send the same token on connect.
- See `server/sqlrooms-duckdb-server/README.md` for full options and protocol details.

## Run this example

From the repo root:

```bash
pnpm build
cd examples/query-websocket
pnpm dev
```

Open the URL printed by Vite. Ensure the server continues running on port `4000`, or update the connector `wsUrl` if you change the port.
