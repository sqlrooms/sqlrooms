# M4 Bubblewrap isolation — 2026-10-26

> Historical verification: Docker support was retired on 2026-10-27. Current
> enforced isolation is Bubblewrap on Linux/Sprite; macOS requires explicit
> trusted-local execution. See the [current host README](../../apps/roomie-node/README.md).

This slice adds an explicit Docker-free backend to the existing shared harness
boundary. It does not replace commands, adapters, approval policy, SQLite COMMIT,
revisions, receipts or the existing watchdog. PR #962 remains draft on its
original base. Aggregate resource budgets and the deployed two-hour soak remain
unverified; Bubblewrap is not presented as equivalent to Docker's resource profile.

## Boundary and recovery

Each run has private user/mount/PID/network/IPC/UTS namespaces, zero capabilities,
no-new-privileges, read-only system/runtime/input and bounded supplied tmpfs.
The only host socket mounted inside is a per-run broker. It injects a revocable
MCP-only token for the exact `/mcp` endpoint and proxies explicitly configured
model authorities. HTTPS CONNECT restricts destination authority, not encrypted
SNI or HTTP headers. Direct host networking and abstract Unix sockets are isolated.
The earlier datagram/socketpair-filter idea was bypassed and is not used.

A trusted runner outside the harness and host event loop enforces a deadline and
separate liveness FD, including under stdin backpressure. Namespace identity is
recorded before releasing harness input; the inner entry also confirms a live
broker before executing. Recovery records are atomically published and scoped to
kernel boot/PID namespace, start identity and UID. Startup children require a
private per-run marker. Stale leaderless groups cannot authorize numeric group
kills. Recovery waits for positively identified processes to exit.

The Sprite bootstrap uses privilege only to create a private mount namespace and
fresh procfs, then drops UID/GID, all capabilities and privilege escalation before
Node starts. Host PID numbering stays stable across service restarts; each run
still gets its own PID namespace. No harness receives sudo or a management socket.

The runtime contains Node, Bubblewrap, Codex 0.163.0 and Claude 2.1.310. Only
explicit OPENAI_API_KEY/ANTHROPIC_API_KEY delegation is supported. Personal login
homes are never copied. Docker remains available as its existing explicit mode.

## Verified checks

- 99 native tests pass locally, including existing real Docker regressions. Eight
  Linux-only Bubblewrap cases are explicitly skipped on macOS and run separately
  on the actual Sprite: **8 passed, zero skipped, zero failed**.
- Real Codex app-server denies metadata SQL and commits a shared command through
  MCP. Real Claude requests owner approval and commits only after explicit approval.
  Both use credential-free scripted model endpoints; this is actual CLI/adapter
  acceptance, not new external-model inference.
- Actual native file, symlink, proc-root, Sprite/Docker socket, abstract socket,
  host TCP and privilege attempts fail. Nested Codex shell sandbox works.
- Deadline, detached descendant cleanup, saturated stdin, delayed startup after
  runner death, unrelated leaderless group preservation, abandoned partial record
  and stopped-host watchdog cleanup pass.
- Two broker integration tests, 65 Node/Python conformance tests and five fresh
  installed-package tests pass. Host build/typecheck, affected lint, formatting,
  Knip and circular checks pass. Python is unchanged.
- Independent security/correctness review approved after fixing liveness
  backpressure, startup recovery, stale PID ownership and interrupted record writes.

Reproduce the Linux acceptance after building host and test bridge and provisioning
with `bubblewrap/provision.sh`. The CI job includes the complete namespace setup:

```sh
ROOMIE_BWRAP_RUNTIME=/absolute/runtime node --test --test-concurrency=1 \
  --test-timeout=60000 --test-name-pattern=Bubblewrap \
  apps/roomie-node/test/bubblewrap.test.mjs \
  apps/roomie-node/test/bubblewrap-claude.test.mjs \
  apps/roomie-node/test/isolation.test.mjs \
  apps/roomie-node/test/service.test.mjs
```

Install the two fixture wrappers as shown in `.github/workflows/pr-checks.yml`.
On the tested Sprite, run through the documented mount/procfs bootstrap after
clearing capabilities. An ordinary host that supports these operations can run
unprivileged directly. Missing prerequisites fail closed, without trusted-local fallback.

## Private disposable Sprite deployment

The existing `roomie-m4-lifecycle-20261026` service was stopped, its workspace
archived privately, and the exact package upgraded. Its private URL policy and
persistent workspace were retained. The service now selects Codex and Bubblewrap
through the packaged `sprite-service.sh`; Docker is not running.

Launch recovered document `u55i7xr4qutdgdhcc9xad2bm`, revision 2, stable chart,
original idempotent receipt and January/February lifecycle rows 300/450. Real
SIGSTOP caused watchdog replacement of host PID 545 with 2714 and recovered the
same state. Actual Tasks renewal advanced expiry from 20:39:49Z to 20:40:00Z;
cancellation drained work and released the Task. An initial concurrent renewal
probe did not retain its Task at observation time; a separate repeat passed.
That first observation is not counted as successful verification.

An actual run through the installed managed service initialized the native Codex
protocol inside Bubblewrap and cancelled/drained with zero recovery records.
No model key was provisioned, so external model completion is not claimed.
Both full native harness command/approval tests above ran in this same Sprite
against local model fixtures. The M2 order-grain/whole-order-refund fixture and
January 300.00 / February 450.00 expectation are unchanged.

## Remaining limits

Bubblewrap provides no aggregate memory, CPU-rate or PID quota. Per-process
rlimits, supplied tmpfs bounds and an external wall-clock timer do not prevent
all resource starvation; nested user namespaces can also allocate additional
mounts. The watchdog remains inside the same Sprite. Keep aggregate hosted
resource-budget and approximately two-hour unattended acceptance gates open.

Initial Ubuntu 24.04 CI passed all 99 native tests but denied private loopback
setup in the new acceptance step (`RTM_NEWADDR: Operation not permitted`).
The runtime is copied outside Ubuntu's packaged application profiles. The CI
launcher now gets the documented AppArmor `userns` permission through a named
profile, removed after the step; host-wide restrictions remain enabled. This
changes the CI prerequisite, not the harness namespace or capability policy.
The private Sprite has also returned to `cold` and woken with host PID 2714,
committed document revision/data and original receipt unchanged.
