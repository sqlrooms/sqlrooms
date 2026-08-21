import {z} from 'zod';
import {JsonObjectSchema, JsonValueSchema} from '../json';
import {OracleResultSchema} from '../oracle';
import {RunEvidenceEventSchema} from '../evidence';

/** Promptfoo-independent span retained for run diagnosis. */
export const ObservatorySpanSchema = z.looseObject({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  name: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  statusCode: z.number().optional(),
  statusMessage: z.string().optional(),
  attributes: JsonObjectSchema.default({}),
});

/** Normalized run consumed by observatory views. */
export const ObservatoryRunSchema = z.looseObject({
  id: z.string(),
  evalId: z.string(),
  createdAt: z.string().datetime(),
  scenario: z.object({
    id: z.string(),
    version: z.number().int().positive().optional(),
    repetition: z.number().int().nonnegative().optional(),
  }),
  profile: z.object({name: z.string(), version: z.number().optional()}),
  repository: z
    .object({
      commitSha: z.string().optional(),
      workflowUrl: z.string().optional(),
    })
    .default({}),
  model: z.object({
    provider: z.string(),
    modelId: z.string(),
    revision: z.string().optional(),
    upstreamProvider: z.string().optional(),
  }),
  status: z.enum(['passed', 'failed', 'error', 'cancelled', 'unknown']),
  score: z.number().optional(),
  latencyMs: z.number().nonnegative().optional(),
  usage: z
    .object({
      inputTokens: z.number().nonnegative().optional(),
      outputTokens: z.number().nonnegative().optional(),
      totalTokens: z.number().nonnegative().optional(),
      costUsd: z.number().nonnegative().optional(),
      grader: JsonObjectSchema.optional(),
    })
    .optional(),
  counts: z.object({
    tools: z.number().int().nonnegative(),
    nestedAgents: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
  }),
  promptTurns: z.array(z.object({id: z.string(), input: z.string()})),
  answer: z.string(),
  oracleResults: z.array(OracleResultSchema),
  graderFeedback: JsonValueSchema.optional(),
  events: z.array(RunEvidenceEventSchema),
  spans: z.array(ObservatorySpanSchema),
  finalState: JsonValueSchema.optional(),
  unknownMetadata: JsonObjectSchema.default({}),
});

/** Normalized run consumed by observatory views. */
export type ObservatoryRun = z.infer<typeof ObservatoryRunSchema>;

/** Portable output emitted from one or more retained Promptfoo databases. */
export const ObservatoryExportSchema = z.looseObject({
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  source: z.object({
    kind: z.enum(['promptfoo-sqlite', 'summary']),
    label: z.string(),
  }),
  runs: z.array(ObservatoryRunSchema),
  unknownMetadata: JsonObjectSchema.default({}),
});

/** Portable output emitted from one or more retained Promptfoo databases. */
export type ObservatoryExport = z.infer<typeof ObservatoryExportSchema>;

/** Filters supported by the initial runs table. */
export type ObservatoryRunFilters = {
  scenario?: string;
  profile?: string;
  commit?: string;
  model?: string;
  status?: ObservatoryRun['status'];
  from?: string;
  to?: string;
};

/** Applies observatory filters without exposing Promptfoo storage concepts. */
export function filterObservatoryRuns(
  runs: readonly ObservatoryRun[],
  filters: ObservatoryRunFilters,
): ObservatoryRun[] {
  const from = filters.from ? Date.parse(filters.from) : undefined;
  const to = filters.to ? Date.parse(filters.to) : undefined;
  const toExclusive =
    filters.to &&
    /^\d{4}-\d{2}-\d{2}$/.test(filters.to) &&
    typeof to === 'number' &&
    Number.isFinite(to)
      ? to + 24 * 60 * 60 * 1000
      : undefined;
  return runs.filter((run) => {
    const createdAt = Date.parse(run.createdAt);
    return (
      (!filters.scenario || run.scenario.id === filters.scenario) &&
      (!filters.profile || run.profile.name === filters.profile) &&
      (!filters.commit || run.repository.commitSha === filters.commit) &&
      (!filters.model || run.model.modelId === filters.model) &&
      (!filters.status || run.status === filters.status) &&
      (from === undefined || createdAt >= from) &&
      (toExclusive !== undefined
        ? createdAt < toExclusive
        : to === undefined || createdAt <= to)
    );
  });
}

/** Finds the latest successful baseline in the selected run's model cohort. */
export function findAutomaticBaseline(
  runs: readonly ObservatoryRun[],
  selected: ObservatoryRun,
): ObservatoryRun | undefined {
  return [...runs]
    .filter(
      (run) =>
        run.id !== selected.id &&
        run.scenario.id === selected.scenario.id &&
        run.scenario.version === selected.scenario.version &&
        run.profile.name === selected.profile.name &&
        run.profile.version === selected.profile.version &&
        run.model.provider === selected.model.provider &&
        run.model.modelId === selected.model.modelId &&
        run.model.revision === selected.model.revision &&
        run.model.upstreamProvider === selected.model.upstreamProvider &&
        run.status === 'passed' &&
        run.createdAt <= selected.createdAt,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Aggregate metrics for one filtered/grouped set of runs. */
export function summarizeObservatoryRuns(runs: readonly ObservatoryRun[]) {
  const passed = runs.filter((run) => run.status === 'passed').length;
  const value = (selector: (run: ObservatoryRun) => number | undefined) =>
    runs.map(selector).filter((item): item is number => item !== undefined);
  const mean = (values: readonly number[]) =>
    values.length > 0
      ? values.reduce((sum, item) => sum + item, 0) / values.length
      : undefined;
  return {
    runCount: runs.length,
    passed,
    failed: runs.length - passed,
    passRate: runs.length > 0 ? passed / runs.length : 0,
    meanLatencyMs: mean(value((run) => run.latencyMs)),
    totalTokens: value((run) => run.usage?.totalTokens).reduce(
      (sum, item) => sum + item,
      0,
    ),
    totalCostUsd: value((run) => run.usage?.costUsd).reduce(
      (sum, item) => sum + item,
      0,
    ),
    toolCount: runs.reduce((sum, run) => sum + run.counts.tools, 0),
    nestedAgentCount: runs.reduce(
      (sum, run) => sum + run.counts.nestedAgents,
      0,
    ),
    errorCount: runs.reduce((sum, run) => sum + run.counts.errors, 0),
  };
}

/** Field-level comparison used for a selected and last-known-good run. */
export function compareObservatoryRuns(
  selected: ObservatoryRun,
  baseline: ObservatoryRun,
) {
  const selectedFailed = selected.oracleResults
    .filter((result) => !result.pass)
    .map((result) => result.oracleId);
  const baselineFailed = baseline.oracleResults
    .filter((result) => !result.pass)
    .map((result) => result.oracleId);
  return {
    selectedRunId: selected.id,
    baselineRunId: baseline.id,
    status: {selected: selected.status, baseline: baseline.status},
    latencyDeltaMs:
      selected.latencyMs !== undefined && baseline.latencyMs !== undefined
        ? selected.latencyMs - baseline.latencyMs
        : undefined,
    tokenDelta:
      selected.usage?.totalTokens !== undefined &&
      baseline.usage?.totalTokens !== undefined
        ? selected.usage.totalTokens - baseline.usage.totalTokens
        : undefined,
    newlyFailingOracles: selectedFailed.filter(
      (oracleId) => !baselineFailed.includes(oracleId),
    ),
    recoveredOracles: baselineFailed.filter(
      (oracleId) => !selectedFailed.includes(oracleId),
    ),
    eventCountDelta: selected.events.length - baseline.events.length,
  };
}
