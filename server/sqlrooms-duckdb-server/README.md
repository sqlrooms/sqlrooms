# SQLRooms DuckDB Server

[![PyPi](https://img.shields.io/pypi/v/sqlrooms-duckdb-server.svg)](https://pypi.org/project/sqlrooms-duckdb-server/)

A Python-based server that runs a local DuckDB instance and supports queries over WebSockets, returning data in either [Apache Arrow](https://arrow.apache.org/) or JSON format. The server was originally developed for use with [SQLRooms](https://sqlrooms.org), but can be readily used as a generic DuckDB server in other contexts.

> **Note:** This server was initially created as a fork of [Mosaic DuckDB Server](https://github.com/uwdata/mosaic/tree/main/packages/server/duckdb-server), with additional features and improvements.

> **Note:** This package provides a local DuckDB server. To instead use SQLRooms with DuckDB-WASM in the browser, stick to the default [`WasmDuckDbConnector`](https://sqlrooms.org/api/duckdb/interfaces/WasmDuckDbConnector.html).

## Features

- WebSocket endpoint (WS-only)
- Arrow IPC results (binary framed) and JSON responses
- Concurrent query execution using a shared thread pool (per-task cursors)
- Per-query cancellation via `duckdb.interrupt` (WebSocket `type:"cancel"`)
- WebSocket multiplexing with `queryId` correlation
- Subscribe/notify over WebSocket using Socketify publish/subscribe
- Disk-backed result cache with per-key locking (prevents duplicate compute)
- One-time retry on transaction conflicts (e.g., concurrent UPDATE vs ALTER)
- Graceful shutdown (SIGINT/SIGTERM): cancel queries, FORCE CHECKPOINT, close, stop executor
- Optional bearer authentication for HTTP and WebSocket endpoints

## Installation and usage

We recommend running the server in an isolated environment with [uvx](https://docs.astral.sh/uv/). For example, to directly run the server, use:

```bash
uvx sqlrooms-duckdb-server
```

Alternatively, you can install the server with `pip install sqlrooms-duckdb-server`. Then you can start the server with `sqlrooms-duckdb-server --db-path /absolute/path/to/my.db --port 4000`.

### Command-line arguments

- `--db-path` (optional): Path to DuckDB database file. Defaults to `:memory:`.
- `--port` (default: `4000`): Port to listen on.
- `--extensions` (optional): Comma-separated list of extensions to preload. Examples:
  - `httpfs`
  - `spatial`
  - `h3@community`

- `--auth-token` (optional): If provided, enables bearer authentication. WebSocket clients must first send `{ "type": "auth", "token": "<TOKEN>" }`.

Examples:

```bash
# In-memory DB with httpfs only (default)
uv run sqlrooms-duckdb-server

# File-backed DB with multiple extensions
uv run sqlrooms-duckdb-server --db-path /tmp/my.db --port 4000 --extensions httpfs,spatial,h3@community
```

## Developer Setup

We use [uv](https://docs.astral.sh/uv/) to manage our development setup.

Start the server with:

```bash
uv run sqlrooms-duckdb-server --db-path /absolute/path/to/my.db
```

Run `uv run ruff check --fix` and `uv run ruff format` to lint the code.

To run the tests, use `uv run pytest`.

To set up a local certificate for SSL, use https://github.com/FiloSottile/mkcert.

## API

The server supports queries via WebSockets only. Minimal HTTP endpoints are provided for health and diagnostics.

### Health Endpoints (HTTP)

- `GET /healthz`: returns `ok` when the process is healthy.
- `GET /readyz`: returns `ok` when DuckDB is initialized; `503` otherwise.
- `GET /version`: returns JSON with version info.

### WebSocket

- URL: `ws://localhost:<port>/`
- Messages are JSON text frames unless returning Arrow bytes.

Authentication (optional):

- If started with an auth token, the client must send the first message:

  ```json
  {"type": "auth", "token": "<TOKEN>"}
  ```

- On success, server replies `{ "type": "authAck" }`. Any other message before auth results in an error and the connection is closed.

Supported messages:

- Query (optional `queryId`):

  ```json
  {"type":"arrow","sql":"select 1 as x","queryId":"q1"}
  {"type":"json","sql":"select 1 as x","queryId":"q2"}
  {"type":"exec","sql":"create table t(x int)","queryId":"q3"}
  ```

- Result correlation (Arrow): binary frame
  - Layout: `[4-byte big-endian length][header JSON][arrow bytes]`
  - Header JSON example: `{ "type": "arrow", "queryId": "q1" }`

- Result correlation (JSON/OK): text frame

  ```json
  {"type":"json","queryId":"q2","data":"[{\"x\":1}]"}
  {"type":"ok","queryId":"q3"}
  ```

- Cancel in-flight query:

  ```json
  {"type": "cancel", "queryId": "q2"}
  ```

  - Response: `{ "type":"cancelAck","queryId":"q2","cancelled":true }`
  - If the query is already finishing, you may receive the final result instead of an error.

- Subscribe/Notify (server-side notifications):

  ```json
  {"type":"subscribe","channel":"table:orders"}
  {"type":"notify","channel":"table:orders","payload":{"op":"update"}}
  ```

  - Subscribe ack: `{ "type":"subscribed","channel":"table:orders" }`
  - Notify:
    - Broadcast to subscribers via `app.publish`
    - Immediate echo to the sender: `{ "type":"notify","channel":"table:orders","payload":{"op":"update"} }`
    - Ack: `{ "type":"notifyAck","channel":"table:orders" }`

## Concurrency & Cancellation

- DuckDB work runs in a shared thread pool with per-task cursors.
- Per-query cancellation is supported via `duckdb.interrupt`.
- WebSocket multiplexing uses `queryId` correlation in headers/payloads.
- One-time retry on transaction conflicts (e.g., concurrent UPDATE vs ALTER).

## Notes

- Graceful shutdown: SIGINT/SIGTERM cancel in-flight queries, FORCE CHECKPOINT, close connection, stop executor.
- Auth token can be supplied via CLI `--auth-token`.

## Publishing

Run the build with `uv build`. Then test publish with `pnpm prerelease`. We publish using tokens so when asked, set the username to `__token__` and then use your token as the password. Alternatively, create a [`.pypirc` file](https://packaging.python.org/en/latest/guides/distributing-packages-using-setuptools/#create-an-account).
