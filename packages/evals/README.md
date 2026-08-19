# @sqlrooms/evals

Private, evaluator-neutral behavioral evaluation primitives for SQLRooms.

The package defines versioned scenarios, composable oracle results, a durable
run-evidence envelope, and a deterministic AI SDK language model. It has no CLI
application, React, browser, or Promptfoo runtime dependency. Its observatory
adapter uses Node's built-in SQLite API.

## Boundaries

- Scenarios describe user turns, compatible production profiles, fixtures, and
  target-neutral outcome expectations.
- Oracles inspect the final answer, database snapshot, workspace state, errors,
  and mutations. Oracle IDs must be unique and cover every scenario
  expectation; they do not require one exact tool trajectory.
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

No generic execution adapter is defined. The in-process CLI target will be the
first concrete runner; an adapter seam should be introduced only after a second
working target such as MCP exists.

## Example

```ts
import {
  createWorkspaceStateOracle,
  defineScenario,
  evaluateOracles,
} from '@sqlrooms/evals';

const scenario = defineScenario({
  id: 'worksheet.create-chart-map',
  version: 1,
  title: 'Create a chart and map',
  compatibleProfiles: ['worksheet-charts-maps'],
  turns: [{id: 'create', input: 'Create a worksheet with a chart and map.'}],
  expectations: [
    {
      oracleId: 'worksheet-has-chart-map',
      description: 'The worksheet contains valid chart and map blocks.',
    },
  ],
});

const oracle = createWorkspaceStateOracle({
  id: 'worksheet-has-chart-map',
  evaluate: (workspace) => ({
    pass: workspace !== undefined,
    reason: workspace
      ? 'Workspace state captured.'
      : 'Workspace state missing.',
  }),
});

const results = await evaluateOracles([oracle], {
  scenario,
  workspace: {artifacts: []},
  finalAnswer: '',
  errors: [],
  mutations: [],
  metadata: {},
});
```
