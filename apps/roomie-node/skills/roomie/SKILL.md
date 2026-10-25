---
name: roomie
description: Inspect and author durable Roomie analytical documents through shared commands.
---

Use Roomie's MCP search_commands, get_command and execute_command tools.
Discover commands and inspect their input schemas before calling them. Look for
an existing workspace knowledge document with block-document.list/get and follow
its metric definitions. Inspect tables and sample/query data before answering.
Check grain, joins, units, time windows and refund handling explicitly; do not
infer a business definition from a column name. Explain ambiguities to the owner.

Author a document with text explaining the convention and a real chart over the
verified source. Keep the source SQL and values inspectable in the document.
Use explicit document IDs. Every content write requires commit.operationId;
existing documents also require commit.artifactId and commit.expectedRevision.
Read the current revision and re-plan on conflict. Retry uncertain writes with
the identical operation ID and input, never a new operation ID.

Do not access host databases or credentials through shell/files. MCP is the
workspace API. A disconnected browser grants no extra permission. Wait for
required approvals; do not bypass a denial. No shell, Python or rendering
capability is required by this skill. Rendering belongs to the browser viewer.
