# Roomie M4 isolation and locked database verification

Baseline `46bbe53fabf2153ea1fb63933a44965c80f521c6`; existing worktree, branch and
draft PR #962. Current plans and repository instructions were read first. #960
and #959 remain open at `eed050a6` and `8eb7a853`; the PR base is unchanged.

## Boundary

Both adapters can use a prepared Docker container instead of an unrestricted
host subprocess. It has no host-home/workspace mount, a read-only per-run input
mount, bounded writable tmpfs, nonroot identity, dropped capabilities, no-new-
privileges, private PID/mount namespaces and memory/CPU/PID limits. Network
connectivity is retained for model APIs and scoped MCP; this is not an egress
firewall. Model API keys must be explicitly delegated and are redacted. No host
account files, owner credentials or Quack token are inherited. Failure never
falls back to trusted-local mode.

The supervisor revokes the run token and drains container removal before
publishing terminal state. It also covers cancellation while container creation
is pending. Unique creation identities allow cleanup after an ambiguous daemon
response. Restart removes only containers labeled for that workspace before
accepting work. The container-local timer is not a parent-independent watchdog;
an adversarial process can stop it. External lifecycle enforcement remains a
separate M4 gate.

DuckDB locks the entire analytical instance before any caller can obtain it.
Required signed extensions are preloaded; external access, auto-install/autoload
and persistent secrets are disabled. Quack requires preloaded httpfs crypto.
Uploads use a dedicated temporary exchange directory. DuckDB automatically adds
its own analytical database/WAL/spill paths when locking; it does not add the
workspace directory, metadata, credentials or bundles. SQLite COMMIT and shared
revision/receipt behavior are unchanged.

## Actual attempts and outcomes

- Real container processes were given known synthetic private paths and attempted
  adjacent metadata/WAL/data/bundle/credential/other-workspace reads, `..` and
  symlink escapes, Docker-socket access and `/proc/1/root` access. All were denied.
  Reading explicit run input and writing the disposable working directory worked.
- Root filesystem writes and `setuid(0)` failed. The process was nonroot with
  `CapEff=0`, `NoNewPrivs=1`; only enumerated run/model environment keys existed.
  Filling the writable work area hit its actual tmpfs quota, without host writes.
- An isolated native-protocol fixture used real HTTP/MCP to create a committed
  document. Owner-ticket and approval-resolution requests returned 403; its token
  returned 401 in another workspace. Metadata SQL was refused. This exercises
  actual services/processes; the model/native event source is a test fixture.
- Real Quack clients used CONNECT to submit SQL directly to the server instance,
  bypassing the renderer/MCP parser. Re-enabling external access, unlocking,
  altering allowlists, RESET, INSTALL/LOAD, SQLite/native ATTACH, external reads,
  metadata overwrite, view indirection and multi-statement reads were denied.
  Quack analytical writes, chart creation, explicit refresh, export pause/restart
  and import still passed.
- Direct native review probes additionally denied parent traversal and a symlink
  from the allowed exchange area to private metadata. Upload exchange reads worked.
- Delegated-key echo was redacted; pending approval cancellation, immediate
  startup cancellation, descendant termination, workspace container recovery,
  missing-image refusal and a daemon-created container followed by a simulated
  lost client response were tested.
- Real Codex 0.163.0 and Claude 2.1.310 binaries execute in the image. A separate
  credential-free Codex probe used a local scripted model and its normal
  workspace-write sandbox: Codex attempted the requested shell tool, but its
  inner bwrap refused namespace creation under Docker. This is a refusal, not
  a successful shell probe or live-model acceptance. Direct container probes
  above test the outer boundary without relying on that inner sandbox.

An attempted live-model probe involving the owner's private Codex login and
native sandbox bypass was rejected by automatic approval review and was not run.
No personal authentication material was copied. The safer scripted-model probe
used no provider credentials and did not disable Codex's sandbox.

## Verification and remaining gates

All 80 native tests pass locally, including six real container regressions; all
65 shared Node/Python conformance tests pass. Seven focused container/Quack tests
passed again after adding shell and exchange symlink/traversal probes. Host build
and typecheck, formatting, Knip and circular-dependency checks pass. Independent
review approved the slice and independently reran synthetic-key login. Pushed-head
Linux CI is recorded in the current plan. Existing query/upload/session/Arrow, cancellation, restart,
Mosaic and both bundle-history round trips run under the locked configuration.
No Python implementation or SQL guard changes were needed.

This slice does not deliver Sprite deployment, a packaged launcher, an external
watchdog, network egress isolation, native continuation, or the two-hour deployed
soak. The image is built from pinned vendor packages and selected by immutable
local ID; image distribution/update policy remains future work.

References: [DuckDB security controls](https://duckdb.org/docs/2.0/operations_manual/securing_duckdb/overview)
and [configuration scopes](https://duckdb.org/docs/2.0/configuration/overview).
