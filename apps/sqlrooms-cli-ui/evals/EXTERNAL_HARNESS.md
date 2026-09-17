# Headless external harness evaluation

This milestone runs the actual Codex CLI with its native SQLRooms skill loading
and a real MCP Streamable HTTP connection. SQLRooms contains no AI slice,
artifact/chat links, model client, agent tools, or AI configuration in this target.
It runs the existing `document-charts-maps@1` profile against the two
`CLI_BEHAVIORAL_SCENARIOS`, both version **2**. It does not cover the third,
multi-turn scenario.

## Run

Prerequisites: workspace dependencies and built packages, Node 24.9+, an installed
Codex CLI supporting the options below, `codex login`, access to the chosen model,
and permission to bind a loopback socket. Tested with **codex-cli 0.143.0** and
**@modelcontextprotocol/sdk 1.30.0**. The runner defaults to `gpt-5.5` with medium
reasoning; override the model with `SQLROOMS_EVAL_MODEL`. No SQLRooms/OpenRouter key
is used by this target.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter sqlrooms-cli-app evals:external:build
# From the repository root; the output directory MUST NOT already exist.
node apps/sqlrooms-cli-ui/evals/run-external.mjs /tmp/sqlrooms-external-attempt-01
```

Each scenario gets a fresh Node DuckDB fixture and workspace. The harness runs in
a temporary directory containing only the skill and host instructions. The
canonical source is `../skills/sqlrooms`; it is copied into
`.agents/skills/sqlrooms`, discovered by Codex, and invoked with `$sqlrooms` before
the unchanged scenario prompt. Connection/policy metadata is supplied separately.
The model never receives the checks or expected snapshots from the runner.

The exact invocation is saved in each evidence envelope. Its shape is:

```text
codex exec --ignore-user-config --ignore-rules --ephemeral
  --skip-git-repo-check --sandbox read-only --json --color never
  -C <temporary-workspace> --model gpt-5.5
  -c model_reasoning_effort="medium"
  -c mcp_servers.sqlrooms={url=<local-url>,bearer_token_env_var="SQLROOMS_EVAL_MCP_TOKEN",required=true,...}
  -c mcp_servers.sqlrooms.default_tools_approval_mode="approve"
  '$sqlrooms\n\n<unchanged scenario turn>'
```

The token is random per host and passed only in the child's environment. User
configuration and execpolicy rules are not loaded, so unrelated user-configured
MCP servers/hooks do not participate. Other locally discoverable user, admin, bundled, and cached plugin skill paths
are disabled with supported per-invocation `skills.config` entries; their paths
are recorded in the manifest. User settings and authentication files are not
changed or copied. The selected SQLRooms skill and successful reads are recorded.
Codex's shell is read-only, but that is not a complete host filesystem sandbox.
The temporary working directory and instructions prevent accidental evaluation
source access; they are not an adversarial anti-cheating boundary.

Native skill discovery and MCP configuration follow the
[Codex skill documentation](https://learn.chatgpt.com/docs/build-skills) and
[MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
This is one direct harness path; native specialist delegation is not established.

## Composition decision and fidelity

The executable spike demonstrated that domain commands and owned map lifecycle
work without AI. The smallest useful boundary is **app-local
`createCliDomainSlice`**, assembling the room/database/command slices, artifacts,
block documents, maps, and profile command registration. The production browser
store, embedded evaluation target, and external workspace all use it. This
removes the old evaluation-specific slice assembly and fake dashboard adapter.

`createCliCapabilityRuntime` injects a store and mandatory host policy into the
existing `createRoomCapabilityRuntime`. Both it and the browser `CliMcpBridge`
use the same six capability handlers. Command serialization belongs to each
runtime, rather than a module-global queue. A `block-document.get-map` read
command fills the one missing inspection operation, validates document ownership,
and works through the same command registry for UI, embedded, and MCP callers.

Hosts may project command discovery metadata through `describeCommand` without
replacing handlers or changing registry entries. The isolated host uses this to
make `block-document.get` require a non-empty `artifactId` in `get_command` and
explain explicit targeting in `search_commands`. Its policy still enforces that
requirement. The browser keeps the shared command's optional current-document
default. A denied call remains an evaluation error even if the harness recovers.

| Layer                                                    | Browser                                                 | Embedded evaluation                                | External evaluation            |
| -------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| Domain slices, document artifact hooks, profile commands | Shared                                                  | Shared                                             | Shared                         |
| Connector                                                | Existing browser/server connector                       | DuckDB Node fixture                                | Same Node fixture              |
| Artifact registry                                        | Renderers and all persisted types                       | Same type IDs/capability flags; document lifecycle | Same headless registry         |
| AI                                                       | Existing AI, settings, session middleware, specialists  | Same production tools/profile, injected model      | Absent                         |
| Lifecycle                                                | Browser initialization and persistence                  | Domain + AI teardown                               | Domain + connector teardown    |
| Host services                                            | Layout, other profile slices, CRDT, persistence, Python | Omitted                                            | Omitted                        |
| Capability policy                                        | Existing per-query approvals                            | Embedded command/tool policy                       | Explicit isolated policy below |

Some existing CLI command factories remain typed for the full browser `RoomState`.
The single headless type adaptation is documented in `createCliHeadlessWorkspace`;
the concrete profile exposes only supported domain commands. It does not add
placeholder AI/session state or promise that other profiles are headless.

## Isolated evaluation policy

`EXTERNAL_EVAL_POLICY` is trusted host configuration saved in every run. It allows
the six shared capabilities, bounded SELECTs, and only the document list/get,
map get, document/chart/map creation, block update, and append commands required
by the suite. Targeted commands require explicit document IDs. Other commands,
caller-provided confirmation, and implicit current-document targeting are denied.
Command input validation and existing high-risk/confirmation gates still apply.

The database is in memory with only the existing ambiguous geospatial fixture.
After the connector loads its required Arrow extension and fixture, the host sets
`enable_external_access=false`. The shared parser still rejects non-SELECT SQL,
internal metadata access and dynamic table references. Neither SELECT validation
nor this evaluation policy is an OS sandbox, a general SQL authorization system,
or a query CPU/memory budget. Production query permissions are unchanged.

## Grading, evidence, and failures

The runner uses the existing shared seed, normalized snapshot function,
`createCliScenarioChecks`, `evaluateBehavioralChecks`, and `RunEvidenceSchema`.
It does not author or repair agent output after seeding. Grades use the final
assistant answer, not interim plans. No LLM grader is involved.

Every attempt has an exclusive directory with a manifest written before execution,
scenario/profile versions, revision/dirty state, execution bundle hash, harness
version, skill/reference hashes, policy, exact invocation, raw harness JSONL and
stderr, independent SQLRooms request/result and mutation events, fixture/final
snapshots, and check results. Usage is reported when Codex emits it; configured
model identity is distinguished from the unobserved resolved backend identity.
Raw logs may contain synthetic fixture content and local paths; inspect them
before sharing outside your team. Credentials are not copied into evidence.

A missing CLI, failed login, failed transport, missing observed skill read, timeout,
cancellation, operation failure, or cleanup failure is an error, never a passing
skip. Behavioral check failures are separate. Four-minute scenario limits,
30-second capability limits, bounded inputs/results, an 8 MiB process-output cap,
and process-group termination bound harness execution. The executable also runs
the complete suite in a supervised child with a nine-minute deadline and a
ten-second cancellation grace period, including setup, grading, and cleanup. `finally` closes MCP and its
connections, disposes the runtime/store/DuckDB, and removes the temporary skill
workspace. Runtime draining waits for actual handlers/commands, not just their
cancelled caller promises. If a stage cannot settle within the grace period,
the supervisor kills the worker and remaining harness groups, removes reported
temporary directories, and records `supervisor.json`; forced termination is never
a pass. SQLRooms/DuckDB resources are then reclaimed with the worker process. POSIX process groups are used; Windows is not verified.

There are **no automatic reruns**. Keep all failed directories. Record the cause
and change before starting a new attempt. Retain full runs as local or hosted
artifacts outside Git; commit concise delivery records with artifact locations
and checksums. Preserve failed attempts in the same archive as successful ones. Infrastructure retries must use a fresh
fixture. A successful two-scenario demonstration establishes feasibility, not a
reliability rate or equivalence of orchestration. The embedded live suite is a
separate before/after comparison, never a substitute for the external harness.

## CI placement

Deterministic MCP discovery, policy, and lifecycle tests already run in the PR
workflow's CLI tests and `evals:test`. The explicit-target discovery regression
belongs there; it needs no model credentials.

Live external runs should be a separate, initially manual, non-blocking job
alongside the embedded Promptfoo job in `evals-nightly.yml`. Keep the actual
Codex process and its native skill/MCP path, with independent results and exit
status; do not replace it with a Promptfoo model-provider call. The targets
already reuse SQLRooms scenarios, fixtures, snapshots, and checks. A shared
runner or observatory adapter can wait until there is a concrete consumer.

No hosted external job is enabled yet. Before enabling one, establish dedicated
CI harness authentication/model access, pin the tested CLI version, verify its
sandbox on the runner, and agree on artifact retention. Missing prerequisites
must fail explicitly, and all attempts need retention even on failure. Current
external evidence stays local; the existing embedded Promptfoo job is unchanged.

## Milestone evidence and exclusions

See [the delivery record](evidence/headless-delivery/README.md) for attempts,
regression results, and outstanding verification. The implementation and skill
are small app-local adapters, not a production plugin distribution or universal
runner API.

Browser external mode, imports, rendered/capture correctness, production
persistence/restart, WebMCP, and additional harnesses remain outside this milestone.
Embedded specialist routing, session links, models, and tools are retained.
