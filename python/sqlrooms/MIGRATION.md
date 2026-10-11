# Consolidated Python runtime migration

The next release maintains one `sqlrooms` distribution and one ASGI listener per
workspace. `sqlrooms-server` is no longer built or published by this repository.
Historical PyPI releases remain available. External standalone-server usage is
unknown; documented consumers were inventoried in
`dev-docs/verification/python-consolidation.md`. A final metadata-only deprecation
release can be decided at release time; this change publishes nothing.

## Upgrade safely

Stop existing workspaces after saving and confirming browser flush. Keep database
and uploads backups. Prefer a fresh virtual environment or a fresh `uv tool`
installation. For an existing pip environment, uninstall **both old distributions
before installing the consolidated wheel**:

```sh
python -m pip uninstall sqlrooms sqlrooms-server
python -m pip install /path/to/sqlrooms-<new-version>-py3-none-any.whl
python -m sqlrooms --version
```

The old wheels shared `sqlrooms/server` files. Installing the new wheel first and
then uninstalling `sqlrooms-server` can delete files owned by the new installation.
If that happened, force-reinstall the consolidated wheel. Remove old tool
installations with `uv tool uninstall sqlrooms-server` before installing the new
`sqlrooms` tool. Verify no stale `sqlrooms-server` or `sqlrooms-duckdb-server`
console scripts remain. There is no shim distribution or command alias.

## Commands and endpoints

| Before                                             | After                                           |
| -------------------------------------------------- | ----------------------------------------------- |
| `sqlrooms-server --db-path data.db --port 4000`    | `sqlrooms server --db-path data.db --port 4000` |
| `sqlrooms data.db --ws-port 4000 --mcp-port 42100` | `sqlrooms --port 3000 --mcp data.db`            |
| `ws://127.0.0.1:4000`                              | `ws://127.0.0.1:<port>/ws/duckdb`               |
| separate MCP listener                              | `http://127.0.0.1:<port>/mcp`                   |

`--no-ui` uses the same runtime as `sqlrooms server`; neither starts hidden
listeners. Old port flags are rejected with guidance. Databases named `server`
or `agent` need an explicit path (`./server`, `./agent`). One Uvicorn worker owns
one writable database. Vite keeps its HMR port and explicitly proxies `/api`,
`/auth.json`, `/ws/duckdb`, and `/ws/mcp-bridge` to the backend.

All clients now authenticate. Native clients read the owner-only credential
handoff printed in the launch log; browser examples redeem single-use launch
tickets. See [AUTHENTICATION.md](AUTHENTICATION.md). Do not copy native credentials
into browser bundles or disable authentication for development.

Restart old workspaces and the stdio connector after upgrading. Control contract
version 2 rejects old runtime registrations. Regenerate generated agent setup and
manually update user-customized MCP entries to the new endpoint; those entries
are never overwritten automatically. Browser-owned tools still need an initialized
browser and retain command/query approval policy. Connector restart does not shut
down managed workspace processes.

The transport now uses bounded queues. A client exceeding the 128 MiB outgoing
byte limit, 64 outgoing message limit, or 15-second send timeout receives a 1013
close. WebSocket compression is disabled to keep large Arrow transfers from
blocking HTTP and cancellation on the shared event loop; this increases network
bytes on remote links. Disconnect interrupts pending work but cannot undo already committed SQL.
A failed final CRDT save or database checkpoint is a close failure, not a successful
save. Forced termination cannot promise persistence.
