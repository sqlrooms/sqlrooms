# SQLRooms DuckDB Server

[![PyPi](https://img.shields.io/pypi/v/sqlrooms-duckdb-server.svg)](https://pypi.org/project/sqlrooms-duckdb-server/)

A lightweight DuckDB server for [SQLRooms](https://sqlrooms.org), built on FastAPI. It communicates over WebSockets only and returns results in [Apache Arrow](https://arrow.apache.org/) IPC stream format.

> **Note:** This server was initially created as a fork of [Mosaic DuckDB Server](https://github.com/uwdata/mosaic/tree/main/packages/server/duckdb-server), with additional features and improvements.

> **Note:** This package provides a local DuckDB server. To instead use SQLRooms with DuckDB-WASM in the browser, stick to the default [`WasmDuckDbConnector`](https://sqlrooms.org/api/duckdb/interfaces/WasmDuckDbConnector.html).

## Installation and usage

We recommend running the server in an isolated environment with [uvx](https://docs.astral.sh/uv/). For example, to directly run the server, use (database path required):

```bash
uvx sqlrooms-duckdb-server --db-path /absolute/path/to/my.db
```

Alternatively, you can install the server with `pip install sqlrooms-duckdb-server`. Then you can start the server with `sqlrooms-duckdb-server --db-path /absolute/path/to/my.db`.

### Command-line Arguments

The server accepts the following command-line arguments:

- `--port`: Specify the port to listen on (default: 3000)
- `--db-path`: Specify the path to the DuckDB database file (required; no default)

Example:

```bash
uvx sqlrooms-duckdb-server --port 3456 --db-path my_database.db
```

### Use as a library (embed in your Python app)

You can embed the server inside your own Python application. Two common options:

1) Quick start with the built-in bootstrapper:

```python
from pkg.__main__ import serve

if __name__ == "__main__":
    # Creates the DuckDB connection, disk cache, and runs the ASGI server
    serve(db_path="/absolute/path/to/my.db", port=3000)
```

2) Full control over the ASGI app and server lifecycle:

```python
from diskcache import Cache
from pkg.server import create_app
from pkg.db_async import init_global_connection
import uvicorn

def main():
    # Initialize the global DuckDB connection once at startup
    init_global_connection("/absolute/path/to/my.db")

    # Create a cache for query results
    cache = Cache()

    # Build the FastAPI app that exposes the SQLRooms endpoints
    app = create_app(cache)

    # Run with uvicorn (or mount `app` into your larger ASGI application)
    uvicorn.run(app, host="0.0.0.0", port=3000, log_level="info")

if __name__ == "__main__":
    main()
```

### Add custom endpoints

This server is intentionally minimal and WebSocket-only for query execution. Extending with additional HTTP routes is not supported in this simplified build.

## Developer Setup

We use [uv](https://docs.astral.sh/uv/) to manage our development setup.

Start the server with `uv run sqlrooms-duckdb-server --db-path /absolute/path/to/my.db`. The server will not restart when the code changes.

Run `uv run ruff check --fix` and `uv run ruff format` to lint the code.

To run the tests, use `uv run pytest`.

To set up a local certificate for SSL, use https://github.com/FiloSottile/mkcert.

## API

Only a single WebSocket endpoint is exposed at `/`.

- Send a text frame containing JSON with the following shape:

```json
{"type": "arrow", "sql": "select 1 as x"}
```

- The server responds with a binary frame containing an Arrow IPC stream (one or more record batches). You can read this using Arrow libraries in your client environment.

## Publishing

Run the build with `uv build`. Then publish with `uvx twine upload --skip-existing ./dist/*`. We publish using tokens so when asked, set the username to `__token__` and then use your token as the password. Alternatively, create a [`.pypirc` file](https://packaging.python.org/en/latest/guides/distributing-packages-using-setuptools/#create-an-account).
