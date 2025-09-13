# SQLRooms DuckDB Server

[![PyPi](https://img.shields.io/pypi/v/sqlrooms-duckdb-server.svg)](https://pypi.org/project/sqlrooms-duckdb-server/)

A Python-based server that runs a local DuckDB instance and support queries over Web Sockets or HTTP, returning data in either [Apache Arrow](https://arrow.apache.org/) or JSON format.

> **Note:** This server was initially created as a fork of [Mosaic DuckDB Server](https://github.com/uwdata/mosaic/tree/main/packages/server/duckdb-server), with additional features and improvements.

> **Note:** This package provides a local DuckDB server. To instead use SQLRooms with DuckDB-WASM in the browser, stick to the default [`WasmDuckDbConnector`](https://sqlrooms.org/api/duckdb/interfaces/WasmDuckDbConnector.html).

## Installation and usage

We recommend running the server in an isolated environment with [uvx](https://docs.astral.sh/uv/). For example, to directly run the server, use:

```bash
uvx duckdb-server --db-path /absolute/path/to/my.db --port 3000
```

Alternatively, you can install the server with `pip install duckdb-server`. Then you can start the server with `duckdb-server --db-path /absolute/path/to/my.db --port 3000`.

### Command-line arguments

- `--db-path` (required): Path to DuckDB database file
- `--port` (default: 3000): Port to listen on

## Developer Setup

We use [uv](https://docs.astral.sh/uv/) to manage our development setup.

Start the server with:

```bash
uv run duckdb-server --db-path /absolute/path/to/my.db
```

Run `uv run ruff check --fix` and `uv run ruff format` to lint the code.

To run the tests, use `uv run pytest`.

To set up a local certificate for SSL, use https://github.com/FiloSottile/mkcert.

## API

The server supports queries via HTTP GET and POST, and WebSockets.

### HTTP

- Endpoint: `/`
- Methods: `GET`, `POST`
- Request JSON:
  - `type`: one of `exec | json | arrow`
  - `sql`: SQL string
- Responses:
  - `type=json`: `application/json` body (array of records)
  - `type=arrow`: `application/octet-stream` Arrow IPC stream
  - `type=exec`: JSON `{"type":"ok"}`
  - Errors: `500` with JSON body `{ "type": "error", "error": string }`

Example:

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"type":"json","sql":"select 1 as x"}' http://localhost:3000/
```

### WebSocket

- URL: `ws://localhost:<port>/`
- Messages are JSON text frames unless returning Arrow bytes.

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

## Notes

- CORS: HTTP responses add permissive CORS headers. Adjust as needed.
- Graceful shutdown: SIGINT/SIGTERM cancel in-flight queries and stop the executor.

## Publishing

Run the build with `uv build`. Then publish with `uvx twine upload --skip-existing ../../dist/*`. We publish using tokens so when asked, set the username to `__token__` and then use your token as the password. Alternatively, create a [`.pypirc` file](https://packaging.python.org/en/latest/guides/distributing-packages-using-setuptools/#create-an-account).
