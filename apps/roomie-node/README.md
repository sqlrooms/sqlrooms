# Roomie Node workspace host

This is the **M1a foundation draft** of the Roomie Node Workspace and Cloud
Agents plan, stacked on PR #960 (`eed050a6`) and #959 (`8eb7a853`). It is an
in-process host API, with real native databases and shared Roomie commands.
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

**This is trusted local development mode.** There is no HTTP/MCP endpoint, scoped
credential policy, sandboxed harness or locked hosted DuckDB configuration yet.
Quack clients deliberately receive broad analytical authority. Do not deploy
this foundation as the hosted security boundary.

## Remaining plan work

M1a separates content from browser-local IndexedDB preferences. The existing
Python/browser path now writes a version-2 content-only `__roomie.ui_state`
envelope and reads legacy version-1 content; the new Node host stores content
only in Loro. The explicit `stateOwnership.ts` schemas and single-owner field
test reject newly persisted fields until classified. The browser's Node protocol
connection remains a later milestone; these two launch paths are not connected.

M1b–M4 add authenticated MCP, common protocol conformance, harness supervision,
browser SQL/Arrow and committed-content subscriptions, conversations/approvals,
revision-checked browser editing, migration/bundles, platform distribution and
hosted isolation. Loro snapshot compaction and bounded history retention also
remain to be added; this draft replays the committed update log in order.

Do not copy an active workspace directory as a portable bundle. Stop the host
before copying until consistent two-database export is implemented. Artifact
and block IDs are already preserved by durable content recovery.
