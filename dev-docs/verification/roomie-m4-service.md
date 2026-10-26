# Roomie M4 Sprite lifecycle verification

Date: 2026-10-26. Worktree/branch: `roomie-node-workspace` /
`feat/roomie-node-workspace`. Continues draft PR #962 from `2db5d73ef` on its
unchanged base. No Python changes, registry publication or hosted soak claim.

## Implementation

The existing host and launcher now optionally acquire execution leases around
requests, queries/uploads, committed snapshots, paginated event replay, command
work, harness runs, session disposal and persistence shutdown. The separate
Sprite supervisor owns expiring Tasks and hard deadlines; IPC heartbeats cannot
extend admitted work. It kills stalled host process groups, drains labeled
Docker containers, and recovers before accepting another generation. Cleanup
retains its lease and has bounded Docker calls. Kernel service ownership is
acquired before orphan recovery. Quack and trusted-local harnesses stay disabled
in managed mode. One exact HTTPS origin supports the Sprite proxy without
trusting forwarded headers.

The watchdog runs in the same VM, outside the workspace host event loop. It is
not a control-plane/off-VM watchdog. The optional harness still uses the existing
immutable-image Docker boundary. No new model loop or agent-only command path
was added. SQLite COMMIT, revisions and idempotent receipts are unchanged.

## Automated checks

- Host TypeScript/build passes.
- 97 native tests pass, zero skips, using the existing local immutable Docker
  image. Ten service tests cover real query/cancel leases, idle subscriptions,
  SIGSTOP recovery, fixed deadlines despite healthy heartbeats, failed renewal,
  exact origins, cleanup renewal, wake grace, socket close during admission and
  real isolated-process cleanup and release delivery without an acknowledgement
  across idle suspension.
- Approval-wait regression retains its run lease through deadline cancellation,
  process drain and durable terminal publication; missing approval never grants
  permission.
- 35 MCP tests with real DuckDB parsing and explicit gateway-cookie/header
  security coverage pass; 95 browser regressions pass.
- 65 shared Node/Python protocol conformance tests pass.
- Five installed-tarball tests pass outside repository module links.
- Independent review found and verified fixes for stale heartbeat on wake,
  socket close during lease admission, snapshot/replay work tracking, lease
  renewal during cleanup and duplicate-supervisor ownership. Regressions pass.

Reproduction (after building):

```sh
ROOMIE_ISOLATION_IMAGE=sha256:YOUR_LOCAL_TEST_IMAGE pnpm --filter roomie-node test
ROOMIE_CONFORMANCE_PYTHON="$PWD/python/.venv/bin/python" pnpm --filter roomie-node test:conformance
pnpm --filter roomie-node test:distribution
```

## Real Sprite deployment

Disposable Sprite `roomie-m4-lifecycle-20261026`, Linux x86_64 / Node 24.22.1,
uses private Sprite URL authentication (`sprite`, admins). The install helper
created a managed `roomie` service and persistent workspace with harness disabled.
No personal model login files or cloud API credentials were copied.

`test/sprite-acceptance.mjs` runs **inside that disposable Sprite**. It reads the
private owner handoff locally, never prints its token, and exercises the existing
HTTP/WebSocket command and query paths. Upload it using `sprite exec --file`, then
run its `seed`, `renew`, `stall`, and `check` actions with Node. `ticket` is an
optional explicit browser step that prints only a fresh single-use launch link.
Do not run the synthetic seed against a production workspace.

Verified:

- Fresh tarball install, real HTTP UI serving, unauthenticated content rejection,
  CSV upload, revision-checked chart creation, query and duplicate-receipt retry.
- Document `u55i7xr4qutdgdhcc9xad2bm`, revision 2, stable block `stable-chart`,
  synthetic values January 300 / February 450. This lifecycle fixture is not a
  substitute for the M2 order-grain/whole-order-refund fixture, which is unchanged.
- Actual Tasks API renewal during a partial upload: expiry advanced from
  `08:19:24Z` to `08:19:34Z`; cancellation drained and deleted the Task.
- Actual SIGSTOP of the admitted host caused `host heartbeat expired`, process
  removal and automatic recovery to a new host PID. Data, document revision and
  the original command receipt survived. No upload completion was invented.
- A second service invocation failed kernel ownership before any orphan cleanup.
- Graceful service stop/update/start completed with exit 0 and generation drain.

The actual private HTTPS URL rendered the committed histogram and source after
recovery. This exposed two real deployment compatibility issues that were fixed:
bootstrap must retain same-origin gateway cookies, and Roomie uses its existing
`X-SQLRooms-Token` header because the gateway reserves `Authorization`. Default
shared browser-auth behavior remains unchanged; opt-in tests verify origin,
expiry and redirect protections. No owner token entered a URL.

The control plane reported `running` during work and `cold` after clients left.
Wake recovered the same data/document/receipt. An initial wake also exposed a
release-acknowledgement race: Tasks DELETE could permit suspension before its
reply reached the host. Drained release now waits only for IPC delivery;
admission still requires the supervisor's acknowledgement. Independent review
approved that correction and its regression. Final post-fix verification observed `cold` with no browser/tunnel/exec
connection, then woke and queried the workspace successfully. The host PID
remained 20985 across the transition, the original receipt/revision/data matched,
and the Task was released again. No spurious acknowledgement timeout or host
restart occurred.

## Remaining gates

Docker provisioning was initially blocked by automatic approval review. The user
then explicitly approved it **only on this disposable Sprite**. Docker 29.1.3,
buildx, and the unchanged pinned harness/test image were installed. The target's
required resource profile failed closed: runc could not open a container's
`pids.max`. The root cgroup exposed `cpu memory pids` controllers but had no
subtree delegation; explicit attempts to enable each controller returned I/O
errors. No PID/CPU/memory limit or other isolation restriction was removed.

The target-platform isolation suite therefore did **not** pass (four tests
failed, three passed; no deployed isolation claim). Nine non-container service
tests passed on Linux x86_64; the tenth real-container watchdog case was explicitly
skipped there after confirming the platform limitation. The same container case
and all other isolation tests pass on the existing local Docker host. Docker's
test service was stopped after verification, with no running containers; the
persistent no-harness Roomie service remains private and can idle.

The Sprite lifecycle implementation and no-harness deployment are verified, but
the combined lifecycle/harness gate remains unchecked until a target can enforce
the existing container profile. The approximately two-hour unattended hosted
acceptance remains a later, separate M4 item. No second live-model acceptance is
claimed for this slice, and no personal account credentials were copied.
