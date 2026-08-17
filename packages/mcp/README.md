# `@sqlrooms/mcp`

Transport-neutral room capabilities and the internal browser RPC protocol used
by SQLRooms MCP hosts.

The core runtime owns catalog ordering, JSON Schema validation, invocation
policy, cancellation, timeouts, and JSON-serializable results. It does not
depend on React, browser globals, FastAPI, Electron, or an AI SDK.

The browser entry point adapts the runtime to SQLRooms' authenticated host-to-
page WebSocket. That WebSocket is application plumbing: public MCP requests
remain stateless and the live browser room store remains authoritative.

WebMCP is not implemented. A future adapter can map portable capability
definitions to `document.modelContext.registerTool()` without changing the
runtime or capability handlers.
