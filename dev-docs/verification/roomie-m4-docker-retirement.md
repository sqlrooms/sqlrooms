# Roomie Docker retirement — 2026-10-27

The user chose one enforced isolation backend to reduce provisioning, recovery,
packaging and CI complexity. Roomie now supports Bubblewrap on Linux/Sprite.
macOS supports a host without a harness or explicitly selected trusted-local
execution. Neither path silently falls back from isolation to local authority.
Aggregate memory, CPU-rate and PID quotas remain unmet; the unattended two-hour
soak is also still open. Existing deadlines, tmpfs bounds and per-process limits
are not aggregate quotas.

## Changes

Removed Docker image provisioning, daemon launch/recovery, container package
assets, image CLI/service options and image-build CI. `HarnessIsolation` requires
an explicit Bubblewrap runtime. Retired image-shaped API/service settings and
`--isolation-image` are rejected. The development live driver also rejects an old
`ROOMIE_ISOLATION_IMAGE` setting before creating a workspace; it cannot silently
downgrade that request. Older Docker deployments must drain their owned containers
using the old version before upgrading. This change does not uninstall Docker
from any host or delete workspace data.

Shared Codex/Claude adapters, command revisions, receipts, approvals, credential
scopes, recovery and DuckDB configuration locks are unchanged. The private Sprite
keeps its existing gateway ingress, model key wrapper and Bubblewrap runtime.
Earlier verification reports are marked as historical wherever they describe
Docker support. The authoritative plan records the revised platform scope.

## Verification

- macOS native suite: 97 pass, 12 explicitly skipped Linux-only cases, zero fail.
- Actual disposable Sprite: 15 selected acceptance/rejection cases pass, zero
  skipped and zero failed. This includes both real CLIs against scripted models,
  scoped MCP commits, metadata denial, redacted delegated credentials, pending
  approval/cancellation, disposable Codex login, deadlines and watchdog cleanup.
- Preserved the useful former Docker assertions in the real Bubblewrap boundary
  test: host environment exclusion and explicit key delegation, read-only root
  and input, work tmpfs ENOSPC, no output written into host input, shell/file/proc
  denial and real database/WAL/bundle/owner/other-workspace canaries. The separate
  gateway bypass regression remains intact. Docker-specific aggregate-quota tests
  were removed with that unsupported profile, not credited to Bubblewrap.
- Five installed-tarball tests and all 65 Node/Python conformance tests pass.
  Packaging verifies the container directory is absent and Bubblewrap bootstrap
  is present. Host build/typecheck, affected lint, Knip and formatting pass.
- Independent review approved after fixing the retired live-driver setting and
  restoring the useful boundary assertions. The reviewer independently reran four
  rejection regressions.

The dedicated Linux CI step provisions the same pinned runtime and now copies
`scripted-claude.mjs` alongside the two real-CLI fixture wrappers. Run that step's
namespace bootstrap with `ROOMIE_BWRAP_RUNTIME` configured. To include the portable
migration/rejection cases too, use `--test-name-pattern='Bubblewrap|retired|obsolete'`
with the same five test files. Ordinary native tests also cover retired settings.

The original first local conformance invocation omitted its required Python
interpreter and did not run tests; the corrected run explicitly supplied
`ROOMIE_CONFORMANCE_PYTHON` and passed all 65 cases. No Python source changed.
The known unrelated MapLibre full-workspace type mismatch remains unchanged.
Six concurrent ai-core edits are excluded from this slice. Draft PR #962 retains
its original base and remains unmerged. Deployment and final-head CI results are
recorded in the PR and authoritative plan.

## Deployed acceptance

The updated tarball is installed on the same private Sprite. Its existing model
key wrapper and gateway sign-in are preserved; the installed package contains no
container directory. A new live Codex turn succeeded with “Roomie live chat is
working.” and rendered in the browser. No document tools were requested.

The old synthetic smoke driver expected document revision 2 and failed after
deployment because the user had already committed revision 3. Comparison with the
stopped-workspace backup taken immediately before upgrading proves the complete
commits, revisions, content events, identity and upload receipts are unchanged.
The lifecycle analytical rows remain January 300 / February 450. No user content
or unsent browser draft was reverted to make the old assertion pass.
