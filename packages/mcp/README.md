# `@sqlrooms/mcp`

> **Experimental:** This package's API and behavior may change between releases.

Transport-neutral room capabilities and the internal browser RPC protocol used
by SQLRooms MCP hosts.

The core runtime owns catalog ordering, JSON Schema validation, invocation
policy, cancellation, timeouts, and JSON-serializable results. It does not
depend on React, browser globals, FastAPI, Electron, or an AI SDK.

Public entry points:

- `@sqlrooms/mcp` exports the transport-neutral runtime and capability types.
- `@sqlrooms/mcp/browser` registers the authenticated browser bridge.
- `@sqlrooms/mcp/protocol` exports the versioned internal bridge schemas.

The browser entry point adapts the runtime to SQLRooms' authenticated host-to-
page WebSocket. That WebSocket is application plumbing: public MCP requests
remain stateless and the live browser room store remains authoritative.

The CLI asks the user to allow each MCP `query` call. That approval and the
single-`SELECT` parser check are guardrails, not a SQL sandbox: approved DuckDB
SQL can still access host resources through functions or extensions. Hosts
embedding this package must isolate or restrict their query connector when
untrusted SQL requires a true host-side security boundary.

The internal browser bridge protocol is version `1` in both TypeScript
(`MCP_BRIDGE_PROTOCOL_VERSION`) and Python (`mcp_bridge.py`). Any wire-format
change must update both definitions together. This is separate from the public
MCP Streamable HTTP protocol negotiated by the official MCP SDK.

WebMCP is not implemented. A future adapter can map portable capability
definitions to `document.modelContext.registerTool()` without changing the
runtime or capability handlers.

The browser bridge accepts an optional `onFlush` callback for authenticated host lifecycle control (`workspace.flush`). It is independent of the advertised workspace tools. Hosts must drain ongoing operations and observe persistence success before reporting a graceful close. Returning no successful result prevents the CLI host from stopping.

## Authenticated local applications

The `@sqlrooms/mcp/browser-auth` entry exports
`createBrowserAuthorization({product, name})`. Each instance owns its page
credential, binding and session-storage key. It redeems `<product>-ticket` URL
fragments, removes them from browser history, renews page sessions, and provides
`authorizedFetch` and `pageCredential`. Native credentials remain server-side.
SQLRooms and Roomie use the same implementation with distinct product settings.

The `@sqlrooms/mcp/room` entry composes the capability runtime with a room store:

- `createLocalRoomCapabilities` exposes bounded query, table/schema discovery,
  command search, command inspection and command execution. Its optional
  `commandFilter` limits both discovery and execution to the host's chosen
  command surface, including commands registered after startup.
- `createLocalCapabilityRuntime` applies transport limits and tracks pending
  operations, including commands still settling after cancellation. Await
  `drain()` during persistence-confirmed close.
- `createLocalDataCommands({resolveLocalFile, metaNamespace})` registers
  `db.import-file` and `db.create-table-from-query`. The host owns local file
  resolution and must supply its metadata namespace.
- `inspectLocalSelect`, `needsLocalReadApproval` and `assertLocalDestination`
  protect query and write boundaries. The application must provide its
  authorization policy and per-request approval callback.
- `requestMcpQueryApproval`, `useMcpQueryApproval` and
  `resolveMcpQueryApproval` implement the shared bounded browser approval queue.
  `cancelAllMcpQueryApprovals` settles pending requests during teardown.
- `LOCAL_MCP_TOOLS` and `LOCAL_MCP_CONTRACT_VERSION` describe the shared tool
  protocol; application commands remain discoverable from their actual registry.

These adapters are shared by both local applications. The room entry depends on
room-shell; room-shell does not depend on this experimental private package.
