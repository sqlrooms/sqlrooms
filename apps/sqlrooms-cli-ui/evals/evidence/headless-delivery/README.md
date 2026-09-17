# External harness delivery record — 2026-09-17

See [implementation, run command, policy, and fidelity](../../EXTERNAL_HARNESS.md).
These are feasibility attempts, not reliability measurements. All scenarios and
behavioral checks are unchanged, at version 2; the profile is
`document-charts-maps@1`.

## Archived evidence

Generated run output is retained outside source control in
`artifacts/headless-delivery-2026-09-17.zip` at the repository root. The archive
contains all 38 original files, including failed and superseded attempts, full
harness streams, evidence envelopes, manifests, snapshots, and check logs. Every
archived file was compared byte for byte with its original before untracking.
The evidence is intentionally retained on the local machine for now; no hosted
download is available. Preserve the archive when removing this worktree.

SHA-256: `9a992e50599cfe470281778d868c5d002339af68b30bdaa5d24c1cbc0508643e`

Verify from the repository root:

```sh
(cd artifacts && shasum -a 256 -c headless-delivery-2026-09-17.zip.sha256)
```

Paths below refer to files under `headless-delivery/` inside that archive.
Generated logs and envelopes are ignored in Git; this delivery record is the
only tracked file in this directory. Small deliberate test fixtures belong with
the tests. The evidence commits were consolidated out of the PR branch history;
a local backup retains the earlier commits. Previously pushed objects may still
be retained by GitHub, so this is source-control cleanup, not a data purge.

## Attempts (none discarded or silently retried)

- `spike-01.log`: deterministic proof failed because map input omitted required
  `config` and `reasoning`. Corrected to the existing command schema.
- `checks/ai-free-proof.log`: passed real DuckDB Node initialization,
  document/chart/map commands, snapshots, owned-map deletion, and disposal with
  no `ai`, `aiSettings`, or `artifactAi` state.
- `embedded-before-*.json`: both **error**, not pass. OpenRouter DNS failed in
  the sandbox. Automatic approval review rejected network-enabled reruns;
  provider authorization remains outstanding. No post-extraction live run.
- `external-01/`: both recorded passed, **superseded as acceptance evidence**.
  Review found that grounding included progress messages. Fixed final-answer
  grading, added bundle hashing and observed skill-read checks, disabled unrelated
  skills, and strengthened operation draining and supervision.
- `external-02/`: both **error**, despite passing state checks. Native skill
  invocation supplied its body without an auditable `SKILL.md` read. Create also
  reported only a SQL-quoted table name, failing the unchanged grounding check.
  Added an explicit file-read instruction and skill v2 guidance to report
  human-readable `schema.table` identity. Checks and expectations were unchanged.
- `external-03/`: **accepted demonstration**, both scenarios passed all five
  checks each. Codex CLI 0.143.0, configured `gpt-5.5` / medium effort, skill v2,
  implementation `d5ab839cb`, scenario version 2, profile `document-charts-maps@1`.
  Each freshly seeded run observed the installed skill and all three references,
  used real MCP, and made zero SQLRooms-owned model calls. Supervisor exit 0,
  no forced termination or cleanup errors. Create: 60.243 seconds; mutate:
  48.740 seconds. These observations do not establish comparative performance.

The accepted run's `manifest.json`, `supervisor.json`, and each scenario's
`*.evidence.json` and `*.stdout.jsonl` contain versions/hashes, policy, invocations,
mutations, snapshots, checks, and separate harness output. Create produced one
correct document/chart/map using the canonical table. Mutate edited the chart
in place, added the source note, and preserved identities and unrelated state.
No fixture, snapshot contract, expectation, or behavioral check changed between
attempts; authored output was never repaired. Historical hashes describe their
actual run and were not rewritten after subsequent skill formatting changes.

## Deterministic verification

- Before extraction: **30 CLI suites / 170 tests / 3 snapshots passed**. The
  subsequent Node WebSocket test initially hit a sandbox loopback-port denial;
  the unchanged 14 Node tests passed with loopback permission.
- After extraction and reviewed fixes: **34 CLI suites / 179 tests / 3 snapshots
  passed**, including scripted embedded specialist/tool routing and session
  lifecycle tests. A catalog expectation was updated for the new read command.
- Shared MCP: **13 tests passed**. Shared evaluation package: **31 tests passed**.
- Real MCP SDK client test covers discovery/invocation, table ambiguity, bounded
  SELECTs, non-SELECT/external file denial, explicit target requirements, command
  policy, and shutdown. A second test proves actual command draining after
  cancellation, including an operation that ignores the abort signal.
- Harness process tests cover success, failure, deadline, cancellation and reaping.
  Supervisor tests cover stuck setup under deadline and cancellation, forced
  reaping and temporary-directory cleanup (**2 tests passed**).
- CLI TypeScript check and browser Vite build passed. Build warnings about large
  chunks and existing dependency `eval` usage remain; visual browser acceptance
  is outside the milestone.
- Skill frontmatter validator passed. Git commit hooks ran workspace package lint
  and formatting. Independent review identified and verified the fixes to final
  answer grading, guidance evidence, and real-operation draining.
- The initial pre-push Knip check did not discover the external runner through
  its custom Vite configuration. Declared that runner in the existing Knip entry
  list; the full Knip check then passed.

Logs are under `checks/` in the archive. Deterministic success does not establish
unchanged live-model behavior.

## Remaining verification and fidelity limits

### Follow-up: explicit-target discovery

The user's local `artifacts/external-20260917-144353` run passed create and errored
on mutate. All four mutation/state/answer checks passed, but `no-errors` failed:
the harness first read `block-document.get` with `{}`, received
`permission_denied: Explicit artifactId is required.`, then recovered successfully.
Discovery had incorrectly advertised the browser's optional current-document
default despite the isolated host's stricter policy. Cleanup succeeded.

The fix projects search/inspection metadata in the isolated host while retaining
the shared command and browser defaults. Real MCP regression tests verify the
required non-empty ID, absence of the default, unchanged browser metadata, and
continued policy denial for missing/empty IDs. TypeScript and both MCP tests
passed; the initial sandbox test attempt failed only on loopback binding and was
rerun with permission. No scenario, check, policy, or skill was relaxed.

The declared follow-up `artifacts/external-explicit-target-4eb17b6f5` ran both
scenarios from fresh fixtures on clean revision `4eb17b6f5`: **both passed all
five checks**, with zero failed operations. The mutate trace observed the required
`artifactId` schema and used the explicit ID on its first read. Supervisor exit 0,
no forced termination or cleanup errors. Create took 54.967 seconds; mutate took
53.914 seconds. CLI/model/skill settings and all behavioral checks were unchanged.
Repository pre-push checks also passed, including the full CLI suite. The original
manual evidence and investigation remain local and unchanged; these follow-up
runs are not part of the earlier 38-file archive.

The **live embedded before/after comparison remains unverified**. Credentials are
configured, but automatic approval review denied egress of the synthetic scenario
prompts, fixture/tool results, and repository metadata to OpenRouter without
explicit provider approval. This is a comparison prerequisite, not an external
harness pass or a missing-credential skip.

Only the document/charts/maps domain is shared headlessly. Browser layout,
rendering/capture, imports, Python/browser bridges, production persistence/CRDT,
WebMCP, other harnesses, and native outer-harness specialists are not covered.
The outer harness's read-only shell is not a filesystem read allowlist. The
isolated fixture policy and disabled DuckDB external access do not establish a
complete OS sandbox or a query CPU/memory budget. Resolved backend model identity
and costs remain unknown when the harness does not emit them.

## Shared OpenRouter CI follow-up

The user explicitly authorized both CI targets to use `OPENROUTER_API_KEY`,
superseding the earlier provider-approval blocker. Repository variable
`SQLROOMS_EVAL_MODEL` now selects both targets, initially
`deepseek/deepseek-v4-flash-0731`. This does not provide a historical embedded
before-extraction baseline.

[First CI attempt](https://github.com/sqlrooms/sqlrooms/actions/runs/35229116358),
revision `c920072cc`: external authentication and real MCP worked, but both
scenarios errored. The Linux sandbox shell could not launch, so required skill
reads were not observed. Create also made invalid map calls and failed canonical
bindings; mutate passed its four state/answer checks. The custom-model fallback
metadata warning was initially classified as an error. Supervisor cleanup was
normal. Full failed evidence is retained in the workflow artifact and locally at
`artifacts/ci-openrouter-35229116358/external/`; the job log is
`artifacts/ci-openrouter-external-35229116358.log`.

Before any follow-up: install the documented Ubuntu Bubblewrap/AppArmor profile
and verify read-only shell access before invoking the model; narrowly classify
the known fallback-metadata message as a retained warning. Scenarios, guidance,
checks and expected snapshots remain unchanged. The follow-up will use the
external-only manual dispatch and fresh fixtures, without discarding this failure.
