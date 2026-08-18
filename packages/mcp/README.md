# `@sqlrooms/mcp`

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
