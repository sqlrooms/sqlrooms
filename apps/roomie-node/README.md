# Roomie Node workspace host

This is the **M1–M3 and initial M4 draft** of the Roomie Node Workspace and Cloud
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

No transaction spans both databases. Analytical uploads have separate intent and
reconciliation records; shell effects never enter the content commit gate.

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

The authenticated MCP endpoint stays loopback-only. The analytical instance is
locked before exposure, and container-isolated harness mode is available below.
Quack clients deliberately receive broad analytical authority. Hosted lifecycle,
external watchdog and unattended release acceptance remain unfinished.

## Remaining plan work

M1a separates content from browser-local IndexedDB preferences. The existing
Python/browser path now writes a version-2 content-only `__roomie.ui_state`
envelope and reads legacy version-1 content; the new Node host stores content
only in Loro. The explicit `stateOwnership.ts` schemas and single-owner field
test reject newly persisted fields until classified. The Node viewer now uses authenticated host subscriptions and the shared chat runtime;
the existing Python/browser launcher remains separate.

M2 provides harness supervision, browser SQL/Arrow and committed-content subscriptions.
M3 adds revision-checked editing, query/upload parity, migration and consistent
bundles. M4 adds the second live harness and the isolation boundary described
below; distribution and hosted lifecycle/soak acceptance remain unfinished.
Loro snapshot compaction and bounded history retention also remain to be added.

Do not copy an active workspace directory as a portable bundle. Use
`exportBundle` for a consistent two-database snapshot with stable IDs.

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
confirmation-gated workspace commands remain denied. Harness-native approvals are
managed by the supervisor; approval of a shell request never grants an MCP policy bypass.
HTTP disconnect does not cancel an accepted durable mutation. Shutdown stops
admission, cancels waiting capability calls, and drains actual accepted work.
A policy decision arriving after timeout or shutdown cannot start a new mutation.
Clients should reconcile a timeout by retrying the same operation. The server
owns its transport; the caller owns and must dispose the workspace afterward.

Bootstrap ports the existing `/auth.json`, `/api/auth/ticket`,
`/api/auth/exchange`, and `/api/auth/renew` protections. Native owners can mint
bounded, two-minute single-use `#sqlrooms-ticket=` launch links. Exchanged page
credentials expire after 30 minutes and can renew while valid; they cannot call
MCP or mint tickets. Page credentials also grant the read-only document/query view and owner run,
approval, and cancellation APIs. The unauthenticated exchange
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
its browser SQL tools and existing acknowledgement semantics; Node exposes bounded ordinary reads,
content commands and its durable commit extension. Shared SQL/Arrow fixtures cover
request IDs, errors, empty schemas, representative types, cancellation, and CRDT
join/snapshot framing. Node rejects raw updates and snapshot seeding; Python
retains its existing client-write semantics.
Node-specific tests separately cover persistence/reopen, revision conflicts,
uncertain responses, denied cross-workspace credentials, expiry/revocation,
late policy decisions, disconnect and shutdown draining.

## Second live harness (M4 starting slice)

Set `harness: {trustedLocal: true, adapter: 'claude'}` in
`startWorkspaceServer` to use authenticated Claude Code 2.1.310. Omitting
`adapter` preserves Codex 0.163.0. `executable` and `model` apply to the selected
adapter. The development driver accepts `ROOMIE_HARNESS=claude`.

Both adapters use the same shared commands, SQLite commit/receipt boundary,
run-event contract, approvals and chat renderer. Claude discovers the same
content-addressed Roomie skill through a per-run plugin copy; discovery and the
effective native tool configuration are checked before work. Approvals never
default to allow. Result errors, command receipts and artifact references remain
visible in the shared UI. Known injected credentials are redacted.

Claude reports usage; both adapters currently report no live input, native-session
continuation, approval recovery, reasoning summaries or plan updates. New runs
persist their harness identifier, while older records remain compatible. A fresh
turn does not imply native context continuation. Cancellation/restart invalidates
pending native approvals. Choose trusted-local or isolated mode explicitly.
Sprite leases, external watchdog and deployed soak acceptance remain unfinished. See
[M4 verification](../../dev-docs/verification/roomie-m4.md).

## Enforced harness isolation and locked analytics (M4)

Build the reviewed image locally; runtime accepts its immutable image ID and
never pulls an image or falls back to trusted-local execution:

```sh
docker build -t roomie-harness-m4:local apps/roomie-node/container
docker image inspect --format '{{.Id}}' roomie-harness-m4:local
```

```ts
await startWorkspaceServer({
  workspace,
  harness: {
    adapter: 'codex', // or 'claude'
    isolation: {
      image: 'sha256:<the-64-character-local-image-id>',
      modelEnvironment: {OPENAI_API_KEY: process.env.OPENAI_API_KEY},
    },
  },
});
```

Use exactly one of `isolation` or `trustedLocal: true`. Run the host as a nonroot
OS user with access to its Docker daemon. Linux uses the host network to reach
the loopback API; macOS Docker Desktop uses `host.docker.internal` with the
original Host header. **This is filesystem/process isolation, not network egress
isolation.** Other services still require their own authentication. Neither
owner nor Quack credentials are delegated. The run token grants MCP only, is
revoked on completion/cancellation, and does not grant browser tickets or approval
resolution. The host owns the Docker daemon; it is never mounted into the run.

The container runs nonroot with all capabilities dropped, no-new-privileges,
private PID/mount namespaces, read-only root, 1 GiB memory, 2 CPUs and 128 PIDs.
Only per-run input files are mounted read-only. The writable working directory
is a 256 MiB tmpfs; temporary home/files use a separate 512 MiB tmpfs. Files,
metadata, WALs, bundles, backups, host home and other workspaces are not mounted.
Shell subprocesses inherit this boundary. Run files are disposable; commands and
SQLite events remain the durable state. No native continuation is advertised.

Only explicitly supplied `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` values enter the
container. Codex's supported API-key login command writes the delegated key into
the disposable home. Host account/configuration files are never copied. Known
delegated keys are redacted from events/blobs. The host environment is not passed
through. `ROOMIE_ISOLATION_IMAGE` selects this mode in `test/live-m2.mjs`; otherwise
that development driver retains explicit trusted-local mode.

Cancellation removes the container before terminal publication. Startup failures
and immediate cancellation do not fall back to the host process. Reopening the
isolated host removes containers labeled for that workspace before admitting
runs. A container-local timer also exits ordinary abandoned work, but is not an
external watchdog or protection against a harness stopping its own timer process.
Codex's nested shell sandbox currently refuses namespace creation under this
container profile; this mode deliberately does not loosen Docker restrictions
for shell execution. Workspace work uses shared MCP commands.

Every workspace now preloads required signed extensions, disables persistent
secrets and automatic extension installation/loading, disables external access,
and locks all configuration before exposing any connection. Quack additionally
preloads `httpfs` for crypto. Upload bytes enter one host-created disposable
exchange directory; no broad home/temp/workspace allowlist is added. DuckDB itself
adds its own analytical database/WAL/spill paths when locking. Metadata, owner
credentials and backups remain outside that allowance. The same locked instance
serves Arrow, imports, Mosaic sessions and Quack, including stop/restart for
consistent bundle export. Renderer SQL policy remains an additional boundary.

For reproducible real-process and Quack bypass acceptance:

```sh
docker build -f apps/roomie-node/container/Dockerfile.test \
  -t roomie-harness-m4-test:local apps/roomie-node
ROOMIE_ISOLATION_IMAGE=$(docker image inspect --format '{{.Id}}' roomie-harness-m4-test:local) \
  pnpm --filter roomie-node test
```

Container tests are opt-in locally and required in Linux JavaScript CI. They use
synthetic canaries and a native protocol fixture, and verify the installed real
Codex/Claude versions. See [isolation verification](../../dev-docs/verification/roomie-m4-isolation.md)
for evidence and limits; this does not complete the hosted M4 release gate.

## Browserless Codex slice (M2)

Requires Node 24 and an authenticated Codex CLI 0.163.0 on PATH. This is explicit
trusted local mode, not hosted isolation. Build packages and the viewer first:

```sh
pnpm build
pnpm --filter roomie-cli-app build
pnpm --filter roomie-node build
```

Start with `startWorkspaceServer({workspace, uiDirectory, harness:
{trustedLocal: true, deadlineMs: 300000}})`. `uiDirectory` is the absolute built
`apps/roomie-cli-ui/dist` directory. Mint a launch ticket using the owner credential
and `/api/auth/ticket`; never put the long-lived owner token in a URL.
The optional `executable` and `model` select the installed Codex executable/model.

The host starts `codex app-server` over bounded stdio, supplies the portable Roomie
skill in an isolated discovery directory, and issues a revocable MCP-only run
token. The canonical skill bytes are content-addressed; the harness gets a copy.
Configured user MCP servers and plugins are disabled for this adapter. This is
configuration hygiene, not a security sandbox: the process uses the owner's local
Codex authentication. The isolated mode below is the enforced alternative;
a parent-independent watchdog and hosted deployment remain M4.

One run is active at a time. Runs, completed message batches, tool activity,
unknown-event diagnostics, and approvals use the same SQLite WAL/FULL writer as
content commits, with a separate workspace-wide event sequence. Token deltas are
not durable events. Known injected tokens are redacted before persistence; output
larger than 16 KiB uses explicit blob retrieval (1 MiB event maximum). Cancellation
and the hard wall-clock deadline revoke credentials, kill the native process
group, drain admitted commands, and publish terminal state. A missing owner
approval waits until a decision, cancellation, or deadline; browser disconnect is
never permission. Restart marks unfinished runs interrupted and invalidates their
native approval requests. It does not resume process memory or native sessions.

The viewer uses the existing SQL/Arrow WebSocket connector and chart/document
renderer. Catalog inspection has its own authenticated DTO endpoint. Render SQL
is limited to verified ordinary local reads; `DESCRIBE` validates the underlying
SELECT before binding. Each query has its own interruptible connection and a
30-second deadline, including validation, with at most four queries and 32 MiB
serialized results. M3 provides bounded connection-local Mosaic preaggregation and explicit cache rebuild on reconnect or refresh.
Documents are read-only. Editor controls are disabled, and raw Loro writes and
snapshot seeding are rejected by the host. Only shared commands can commit content.

The `@sqlrooms/ai-core` harness runtime uses snapshot + bounded history + live
sequence replay. Closing its subscription never cancels work. It displays pending
approvals, explicit stop, tool output, source document links, and new-turn context
limitations. Input during a run is queued locally for the next turn; it is lost
on page reload and is not presented as native live input.

### Local start and browser sign-in

Start or reopen an ordinary workspace without synthetic data:

```sh
ROOMIE_M2_DIRECTORY=/tmp/my-roomie-workspace \
  pnpm --filter roomie-node exec node test/live-m2.mjs
```

Every launch prints a fresh single-use browser sign-in URL, valid for two minutes.
The host stays browserless until you choose to open it. The URL contains only a
bootstrap ticket; the owner credential is neither printed nor placed in a URL.
After expiry or redemption, issue another link while the host is running:

```sh
ROOMIE_M2_DIRECTORY=/tmp/my-roomie-workspace \
  pnpm --filter roomie-node exec node test/launch-ticket.mjs
```

This reads the private `control.json` credential-file reference and calls the
existing owner-authenticated ticket endpoint. Restarting the host invalidates old
credentials and prints a fresh link. `--seed` is only for synthetic demo data in
a new workspace, never needed for sign-in. This is the existing development
launch path, not a packaged launcher or M4 distribution work.

The viewer uses shared sidebar, resizable panels, history rows, composer controls,
message/tool renderers and UI controls. Narrow screens stack the resizable document
and chat panels. History labels use the first prompt and latest durable activity/status.
Native notifications stay in collapsed Diagnostics; one tool disclosure retains
its lifecycle, input/output and document links. Roomie keeps document selection and
workspace approval navigation in the app; approvals and host-run admission remain
host-authoritative. Queued text belongs to the current mounted chat and is lost
when navigating away or reloading. Documents now use local drafts and authenticated revision-checked shared commands. Conflicts retain the draft and expose committed content; uncertain saves retry the original operation ID.

### Reproduce the synthetic acceptance fixture

```sh
# Opt-in model run; this creates a new directory with six synthetic orders.
ROOMIE_M2_DIRECTORY=/tmp/roomie-m2-demo \
  pnpm --filter roomie-node exec node test/live-m2.mjs --seed
```

The driver writes a private `control.json` containing the local URL and credential
file path. Start `/api/runs/start` with the owner credential, an idempotency key,
and a request to inspect workspace knowledge, calculate monthly revenue, and
create a chart document through Roomie commands. The approved definition is one
row per paid order, excluding every order present in refunds; payments contain
retries. Expected values are January 300.00, February 450.00, total 750.00. The
physical `recognized_revenue` source and equivalent orders/refunds SQL must agree.
Open a ticketed browser only after the run. Start another turn, close it, reconnect,
and restart the host without `--seed` to verify history and committed content.

Recorded Codex host events, offline Claude contract recordings, and their limits live in
[`harness-v1`](../../packages/ai-config/fixtures/harness-v1/README.md). Scripted
native protocol tests are labeled separately from real-model evidence.

## M3 query, editing, and portability APIs

The authenticated browser renders shared chart, table, dashboard and HTML
components. `POST /api/commands` uses the same host command registry, policy,
explicit artifact/revision checks and idempotent receipts as agent commands.
`block-document.set-content` accepts exact ProseMirror JSON and an optional title;
it validates nodes, IDs, analytical sources and ownership. Raw CRDT writes and
snapshot seeding remain disabled. HTML revision restore is read-only in this
viewer; revision changes go through commands.

`workspace.upload({operationId, tableName, format}, bytes)` accepts CSV, JSON,
Parquet and Arrow, with a 32 MiB payload and two admitted imports. It creates a
new physical table, never replaces an existing table, and records a native receipt
in the table transaction. A SQLite intent tracks recovery across the two databases.
The browser file picker calls the authenticated upload endpoint; binary
`uploadArrow` WebSocket frames retain the existing protocol.

Reads support Arrow/JSON/exec responses, SELECT/DESCRIBE, exact Decimal128 and
64-bit integers, dates, timestamps, binary and nested values. Raw INTERVAL output
is rejected because Arrow JS 17 misdecodes it; use `CAST(value AS VARCHAR)`.
Date-bin interval arithmetic is supported. Nonrecursive CTE sources are checked in lexical scope with DuckDB-compatible ASCII identifier folding. Ordinary operators, `isfinite` and
`to_days` are validated against live native function metadata. External readers,
views, internal tables, macros and arbitrary writes remain forbidden.

Limits: 512 MiB native memory, four native threads, four active queries, 64 admitted
requests, 16 sessions, 32 temporary cache tables per session, 30-second execution
deadlines, 100,000 result rows, and 32 MiB serialized results. Cancellation removes
queued work without interrupting its predecessor. Only the coordinator's specific
`mosaic.preagg_<hex>` create/drop operations are admitted; their SELECT source
passes the same read policy. Caches are connection-local and disposable.
`workspace.refresh()` / `POST /api/refresh` refresh the catalog after Quack writes;
the browser reconnects and rebuilds coordinator caches.

`await workspace.exportBundle(path, {includeHistory: false})` creates a version-1
`.roomie` bundle. Stop active harness runs first. The host blocks new uploads/runs,
drains accepted uploads, holds the content gate, stops Quack, checkpoints native
DuckDB and captures SQLite with VACUUM INTO. Export resumes Quack and drains during
shutdown. The manifest records format/engine/history policy, file sizes and SHA-256.
Bundles contain data.duckdb, meta.sqlite and assets; never credentials. Maximum
bundle size is 2 GiB, with a 1 MiB manifest and 10,000 files.

`await importWorkspaceBundle(bundle, newDirectory)` validates paths, sizes,
checksums, SQLite integrity/version, committed Loro content and native database
opening before publishing a new workspace. Existing destinations are refused.
Conversation history is opt-in: exclusion removes conversations, runs, approvals,
run events and run blobs. Content revisions, command receipts/audit, provenance
assets and analytical result tables remain, preserving identities and retry safety.

`await migrateLegacyWorkspace({source, destination, contentSource?, roomId?})`
opens an offline legacy DuckDB read-only, preserves it as the backup, and imports
into a fresh directory. Version-1/2 Roomie envelopes and content snapshots are
supported; the shared document mirror accepts block-document snapshots without
unsupported markdown documents. When both stores exist, select the authoritative
one explicitly. Declared analytical bindings are rebound to the new catalog.
Executable legacy HTML apps with a renamed catalog require explicit source
migration first; the importer refuses to silently rewrite application code.
Unknown/future formats fail without modifying the source or existing destinations.

See [M3 verification](../../dev-docs/verification/roomie-m3.md) for the supported
matrix, browser evidence, reproducible latency workload and verification details.

Content snapshots carry a durable monotonic sequence so delayed HTTP delivery
cannot replace newer WebSocket content. Drafts occupy independently owned local
storage slots; reconnect/reload retains a pointer and reopened tabs can explicitly
recover saved copies, including uncertain operations. Saving or discarding one
tab's copy never implicitly deletes another slot.
