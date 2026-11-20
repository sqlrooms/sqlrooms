# @sqlrooms/evals

Private, evaluator-neutral behavioral evaluation primitives for SQLRooms.

The package defines versioned scenarios, composable check results, a durable
run-evidence envelope, and a deterministic AI SDK language model. It has no CLI
application, React, browser, or Promptfoo runtime dependency. Its observatory
adapter uses Node's built-in SQLite API.

## Boundaries

- Scenarios describe user turns, compatible production profiles, fixtures, and
  target-neutral outcome expectations.
- Checks inspect the final answer, database snapshot, workspace state, errors,
  mutations and, for `trajectory` checks, the ordered run events. Check IDs
  must be unique and cover every scenario expectation; outcome checks do not
  require one exact tool trajectory.
- A check can declare `appliesTo` target types. On any other target it reports
  a `notApplicable` result, which satisfies its expectation and is excluded
  from summaries, Promptfoo named scores and calibration rates; trajectory
  graphs show it as `not-applicable`. A runner must pass `target` (and
  `events`, for trajectory checks) to `evaluateBehavioralChecks`. Use this for path checks that only
  make sense for one target, such as in-app tool names.
- Run evidence records strictly ordered events and durable outcomes in a
  versioned JSON envelope. Preserved extension fields must contain JSON values.
- `@sqlrooms/evals/promptfoo` contains structural conversion helpers, a
  read-only SQLite adapter, a Promptfoo-independent observatory read model, and
  a side-effect-free Markdown report renderer. The adapter validates known
  tables and columns, preserves unknown metadata, and exports portable JSON.
  Promptfoo remains a storage/runner boundary, not the core package interface.
- The observatory trajectory model derives ordered and explicit parent/child
  relationships from normalized SQLRooms run evidence, never Promptfoo spans.
  It also reports whether a delegated run benefits from a graph or is clearer
  as an ordered list.
- The scripted model implements the AI SDK v3 language-model contract and can
  assert prompt/tool wiring without credentials or network access.

## External harnesses (`@sqlrooms/evals/external`)

A Node-only entry point runs actual external agent CLIs (Codex, Claude Code)
against an application workspace over a real loopback MCP host. The MCP host
needs the optional peer dependency `@modelcontextprotocol/sdk`, loaded when a
host starts; the process runner, supervisor and harness adapters do not.

- `createCodexHarness` and `createClaudeHarness` own only the CLI contract:
  staging a skill or plugin into a temporary directory, the exact invocation,
  parsing structured output, and verifying that required guidance was read.
- `startEvalMcpHost` serves a fresh MCP `Server` per request with a random
  bearer token, loopback and `Origin` checks, and an owner-only credential file.
- `runExternalScenario` runs one scenario: stage, prepare the workspace, start
  the host, run the harness with a time limit and output cap, grade, and write
  `RunEvidence`. The application supplies `prepare()`, which returns its MCP
  server factory, snapshot, and cleanup hooks. Without `checks`, the run is
  graded elsewhere and its status reflects only errors.
- `superviseExternalWorker` bounds a whole suite in a forked worker and reaps
  harness process groups and temporary directories if it cannot settle.
- `createExternalPromptfooProvider` exposes a run as a Promptfoo provider, so
  existing Promptfoo assertions can grade external runs.

Runs are never retried or repaired. A missing CLI, failed login, unobserved MCP
discovery or invocation, unobserved guidance read, timeout or cleanup failure
is an `error`, kept separate from behavioral `failed` results. A single failed
MCP request (for example one a client abandoned after its tool timeout) is a
diagnostic: an `mcp-transport-failure` event and the `mcpTransportFailures`
count, not a run error. A `timeoutMs` of zero runs without a deadline. The temporary working
directory is not an adversarial isolation boundary.

```ts
import {
  createCodexHarness,
  runExternalScenario,
} from '@sqlrooms/evals/external';

const harness = createCodexHarness({
  skillDir: 'skills/my-app',
  skillName: 'my-app',
  instructions: 'Use the installed skill and MCP for all workspace access.\n',
});
const evidence = await runExternalScenario({
  harness,
  harnessDescription: await harness.describe(),
  scenario,
  checks,
  outputDir: 'evidence/attempt-01',
  target: {
    type: 'my-app-external-codex',
    profileName: 'default',
    profileVersion: 1,
  },
  async prepare(recorder) {
    const workspace = await openFixtureWorkspace();
    return {
      createServer: ({onRequest}) => createMyMcpServer(workspace, onRequest),
      snapshot: () => workspace.snapshot(),
      dispose: () => workspace.close(),
    };
  },
});
```

## Example

```ts
import {
  createWorkspaceStateCheck,
  defineScenario,
  evaluateBehavioralChecks,
} from '@sqlrooms/evals';

const scenario = defineScenario({
  id: 'document.create-chart-map',
  version: 1,
  title: 'Create a chart and map',
  compatibleProfiles: ['document-charts-maps'],
  turns: [{id: 'create', input: 'Create a document with a chart and map.'}],
  expectations: [
    {
      checkId: 'document-has-chart-map',
      description: 'The document contains valid chart and map blocks.',
    },
  ],
});

const check = createWorkspaceStateCheck({
  id: 'document-has-chart-map',
  evaluate: (workspace) => ({
    pass: workspace !== undefined,
    reason: workspace
      ? 'Workspace state captured.'
      : 'Workspace state missing.',
  }),
});

const results = await evaluateBehavioralChecks([check], {
  scenario,
  workspace: {artifacts: []},
  finalAnswer: '',
  errors: [],
  mutations: [],
  metadata: {},
});
```
