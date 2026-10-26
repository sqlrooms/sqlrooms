# Cross-server protocol fixtures

`mcp.json` defines the initial common MCP contract for the existing Python server
and the Node Roomie host. Run it from the repository root with:

```sh
pnpm build
pnpm --filter roomie-node build
ROOMIE_CONFORMANCE_PYTHON="$PWD/python/.venv/bin/python" pnpm --filter roomie-node test:conformance
```

The runner is `apps/roomie-node/test/conformance.mjs`. Both servers are required;
it never silently skips a missing Python environment. The Python target launches
the production HTTP application with a real authenticated WebSocket bridge and
the shared browser command runtime. It mounts no renderer and makes no SQL/Arrow
or CRDT conformance claim. Node-specific durability remains in the native suite.

Fixture `differences` records capability differences without freezing accidental
implementation details. In particular, only the Node `sqlrooms/durable-content-v1`
extension requires `execute_command.arguments.commit` and returns durable receipts.
