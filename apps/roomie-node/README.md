# Roomie Node workspace host

This is the **M1a + M1b draft** of the Roomie Node Workspace and Cloud
Agents plan, stacked on PR #960 (`eed050a6`) and #959 (`8eb7a853`). It is an
in-process host API and authenticated loopback MCP server, with real native
databases and shared Roomie commands.
The Python launcher and browser remain available while the replacement is built.

## Run

Use Node **24.9–24.x** and the repository's pinned pnpm version. Build workspace
packages before the host:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter roomie-node build
pnpm --filter roomie-node test
```

The SSR bundle uses the host's pinned `@duckdb/node-api@2.0.0-r.1` for all native
connector imports; it does not change the native dependency of other packages.
Startup verifies `version() = 'v2.0.0'` and refuses silent engine downgrades.
The existing Node connector initializes the signed `nanoarrow` community
extension, so first startup requires extension download access. New analytical
files use #959's `v1.4.0` storage compatibility policy. This limits storage
features; it does not guarantee every operation is compatible with older engines.

```js
import {openWorkspace} from './apps/roomie-node/dist/index.mjs';

const workspace = await openWorkspace({directory: '/tmp/my-roomie-workspace'});
try {
  const created = await workspace.mutate({
    operationId: 'create-report-1',
    principalId: 'owner',
    commandId: 'block-document.create',
    input: {title: 'Report'},
  });
  await workspace.mutate({
    operationId: 'rename-report-1',
    principalId: 'owner',
    commandId: 'block-document.rename',
    artifactId: created.artifactId,
    expectedRevision: created.revision,
    input: {artifactId: created.artifactId, title: 'Revenue report'},
  });
  console.log(
    await workspace.read('block-document.get', {
      artifactId: created.artifactId,
    }),
  );
} finally {
  await workspace.dispose();
}
```

`openWorkspace` finishes initialization and recovery before returning. `ready`
is resolved at that point; `flush` drains accepted preparations and mutations;
`dispose` is idempotent and waits for accepted work before releasing resources.
Readers receive detached values, never the live store. Stale mutations return
`{success: false, code: 'revision-conflict', artifactId, currentRevision}`.
Keep the same operation ID and input to retry a request. Reusing an ID with
different input is rejected, even after restart.

Only content commands are exposed: document/block authoring, document rename,
owned dashboard configuration and HTML-app revisions. Existing-document writes
must explicitly identify the parent document and its expected revision. The
host has no current selection or saved table preferences. Browser and Node use
the same extracted `createRoomieDomainSlice` and command definitions.

## Durability boundary

- `data.duckdb` contains analytical data. Its native file lock excludes other
  host processes; a canonical-path guard also rejects duplicate in-process hosts.
- `meta.sqlite` contains Loro updates, document revisions, operation receipts
  and ordered command events with principal attribution. Built-in `node:sqlite`
  avoids another native binding distribution; the supported Node major is
  deliberately bounded because this API is still evolving.
- Metadata uses one writer, WAL, `synchronous=FULL`, foreign keys and a five-second
  busy timeout. Schema version 1 is created transactionally; newer versions fail
  closed. Each command writes content, revision, receipt and event atomically.
- A single gate covers content mutation, export and commit. Snapshot, command
  read and audit APIs wait for it. Subscribers receive only durable receipts.
  Catalog refresh and optional read-only `prepareCommand` work happen outside
  the gate; target validation and revision comparison happen inside it.
- Rejected commands discard the Loro document, mirror and content store, then
  replay committed updates into new instances before releasing the gate.
  Database services are independently owned and survive reconstruction.
  An uncertain commit is resolved from a fresh SQLite reader. Unreadable
  receipts or failed reconstruction stop subsequent reads and writes.

No transaction spans both databases. This API deliberately exposes no arbitrary
SQL, file import or shell effect inside the content commit gate. Those operations
need separate intent/reconciliation records in later milestones.

## Quack and platform verification

Quack is **disabled explicitly by default**. Opt in with
`quack: {uri: 'quack:127.0.0.1:19495', token: '<32-or-more-safe-characters>'}`.
Use a cryptographically random token and keep it out of browser renderers.
Quack startup errors propagate; callers can deliberately reopen without Quack.
It serves the same native analytical owner and is independent of document APIs.

Verified on macOS arm64 and Linux arm64 (Node 24.18.0, Debian bookworm).
The native suite covers authenticated Quack and invalid-token rejection, a chart
command over Quack-created data, no-Quack operation, reopen/retry, stale edits,
transaction rollback, tentative reads/publication, nested content, slow
preparation, uncertain responses, failed-closed recovery, owner exclusion and
real process crashes before/after commit.

**This is trusted local development mode.** The authenticated MCP endpoint is
loopback-only. There is no sandboxed harness or locked hosted DuckDB configuration yet.
Quack clients deliberately receive broad analytical authority. Do not deploy
this foundation as the hosted security boundary.

## Remaining plan work

M1a separates content from browser-local IndexedDB preferences. The existing
Python/browser path now writes a version-2 content-only `__roomie.ui_state`
envelope and reads legacy version-1 content; the new Node host stores content
only in Loro. The explicit `stateOwnership.ts` schemas and single-owner field
test reject newly persisted fields until classified. The browser's Node protocol
connection remains a later milestone; these two launch paths are not connected.

M2–M4 add harness supervision, browser SQL/Arrow and committed-content subscriptions, conversations/approvals,
revision-checked browser editing, migration/bundles, platform distribution and
hosted isolation. Loro snapshot compaction and bounded history retention also
remain to be added; this draft replays the committed update log in order.

Do not copy an active workspace directory as a portable bundle. Stop the host
before copying until consistent two-database export is implemented. Artifact
and block IDs are already preserved by durable content recovery.

## Authenticated MCP (M1b)

```js
import {readFile} from 'node:fs/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  openWorkspace,
  startWorkspaceServer,
} from './apps/roomie-node/dist/index.mjs';

const workspace = await openWorkspace({directory: '/tmp/my-roomie-workspace'});
const server = await startWorkspaceServer({workspace});
const client = new Client({name: 'My client', version: '1'});
try {
  // Give a trusted native client only this private file path; never log its token.
  const credential = JSON.parse(await readFile(server.credentialPath, 'utf8'));
  await client.connect(
    new StreamableHTTPClientTransport(new URL(server.mcpUrl), {
      requestInit: {headers: {Authorization: `Bearer ${credential.token}`}},
    }),
  );
  const created = await client.callTool({
    name: 'execute_command',
    arguments: {
      commandId: 'block-document.create',
      input: {title: 'An external report'},
      commit: {operationId: 'report-create-1'},
    },
  });
  const receipt = created.structuredContent.data.receipt;
  await client.callTool({
    name: 'execute_command',
    arguments: {
      commandId: 'block-document.rename',
      input: {artifactId: receipt.artifactId, title: 'Revised report'},
      commit: {
        operationId: 'report-rename-1',
        artifactId: receipt.artifactId,
        expectedRevision: receipt.revision,
      },
    },
  });
} finally {
  await client.close();
  try {
    await server.dispose();
  } finally {
    await workspace.dispose();
  }
}
```

The stateless Streamable HTTP endpoint uses the pinned official TypeScript SDK
1.30.0. It authenticates every request with a freshly generated, workspace-owner
credential. It binds only `127.0.0.1`, validates exact Host and optional Origin,
ignores forwarded routing claims, and sends `no-store`/`no-referrer`. Credentials
from another workspace or a previous server start are rejected. There is no
public token-bearing URL or unauthenticated owner-token exchange. A temporary
POSIX directory (0700) and file (0600) carry credentials outside the workspace;
shutdown removes them, including when the workspace cannot flush. Windows ACLs
and reverse-proxy deployment remain unsupported.

`search_commands`, `get_command`, and `execute_command` reuse the command catalog,
search ranking, input validation, and policy guards. The Node capability
`sqlrooms/durable-content-v1` adds the optional `commit` argument shown above;
it is required for mutations. Read calls need no commit metadata. Existing
content reads and writes require explicit targets. `block-document.get` returns
`data.revision` from the same committed read boundary. Mutations return
`data.receipt` only after durable commit; stale revisions return
`{ok:false, code:'revision-conflict', details:{currentRevision, ...}}`. The stable
owner principal is stamped by the host, never trusted from client metadata.
Keep the same operation ID and input after uncertain responses, even across
restart. An operation ID reused with different input is rejected.

A host can supply an additional `policy.authorize` to deny calls. High-risk and
confirmation-gated commands remain denied; approvals are a later milestone.
HTTP disconnect does not cancel an accepted durable mutation. Shutdown stops
admission, cancels waiting capability calls, and drains actual accepted work.
A policy decision arriving after timeout or shutdown cannot start a new mutation.
Clients should reconcile a timeout by retrying the same operation. The server
owns its transport; the caller owns and must dispose the workspace afterward.

Bootstrap ports the existing `/auth.json`, `/api/auth/ticket`,
`/api/auth/exchange`, and `/api/auth/renew` protections. Native owners can mint
bounded, two-minute single-use `#sqlrooms-ticket=` launch links. Exchanged page
credentials expire after 30 minutes and can renew while valid; they cannot call
MCP or mint tickets. No browser renderer/transport is connected in M1b, so these
page credentials currently grant renewal only. The unauthenticated exchange
body is capped at 4 KiB and MCP request bodies at 256 KiB.

## Protocol conformance

```sh
# Use the existing Python workspace environment after its normal dependency setup.
pnpm --filter roomie-node build
ROOMIE_CONFORMANCE_PYTHON="$PWD/python/.venv/bin/python" \
  pnpm --filter roomie-node test:conformance
```

[Shared fixtures](../../tests/protocol/mcp.json) exercise the same HTTP requests
against the Node host and the real Python launcher, MCP service, authentication,
bootstrap routes and WebSocket broker. The Python target uses the existing
browser capability runtime/Roomie domain without mounting a renderer; it does
not use the Node durable host or a stub broker. The supported common protocol
is MCP `2025-11-25`. Both targets cover discovery, command search/inspection,
input failures, command authoring, matching text/structured results, request IDs,
host policy denial and credential/origin/bootstrap admission. The Python CI job
runs both targets and fails if either cannot start.

Intentional capability differences are recorded in the fixture: Python retains
its browser SQL tools and existing acknowledgement semantics; Node exposes only
content commands and its durable commit extension. SQL/Arrow and CRDT
conformance, browser transport, and real harness sessions remain M2+ work.
Node-specific tests separately cover persistence/reopen, revision conflicts,
uncertain responses, denied cross-workspace credentials, expiry/revocation,
late policy decisions, disconnect and shutdown draining.
