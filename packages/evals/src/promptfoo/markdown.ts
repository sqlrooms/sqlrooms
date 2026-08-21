import {summarizeObservatoryRuns, type ObservatoryExport} from './readModel';

function aggregate(values: readonly string[], fallback: string): string {
  const distinct = [...new Set(values)];
  if (distinct.length === 0) return fallback;
  return distinct.length === 1 ? distinct[0]! : 'mixed';
}

/**
 * Renders a portable observatory export as a compact Markdown report.
 *
 * @param exported - Validated observatory data to summarize.
 * @returns A self-contained Markdown summary with aggregate and per-run data.
 */
export function renderObservatoryMarkdown(exported: ObservatoryExport): string {
  const summary = summarizeObservatoryRuns(exported.runs);
  const lines = [
    '# SQLRooms behavioral eval summary',
    '',
    `- Exported: ${exported.exportedAt}`,
    `- Runs: ${summary.runCount}`,
    `- Passed: ${summary.passed}`,
    `- Failed/errors: ${summary.failed}`,
    `- Pass rate: ${(summary.passRate * 100).toFixed(1)}%`,
    `- Commit: ${aggregate(
      exported.runs.map((run) => run.repository.commitSha ?? 'unknown'),
      'unknown',
    )}`,
    `- Profile: ${aggregate(
      exported.runs.map(
        (run) => `${run.profile.name}@${run.profile.version ?? 'unknown'}`,
      ),
      'unknown',
    )}`,
    `- Model: ${aggregate(
      exported.runs.map(
        (run) =>
          `${run.model.provider}/${run.model.modelId}@${run.model.revision ?? 'unversioned'} (upstream: ${run.model.upstreamProvider ?? 'unknown'})`,
      ),
      'unknown',
    )}`,
    `- Workflow: ${aggregate(
      exported.runs.map((run) => run.repository.workflowUrl ?? 'local'),
      'local',
    )}`,
    '',
    '## Per run',
    '',
    '| Scenario | Repetition | Status | Failed oracles | Latency |',
    '| --- | ---: | --- | --- | ---: |',
    ...exported.runs.map((run) => {
      const failures = run.oracleResults
        .filter((result) => !result.pass)
        .map((result) => result.oracleId)
        .join(', ');
      return `| ${run.scenario.id}@${run.scenario.version ?? '?'} | ${run.scenario.repetition ?? '?'} | ${run.status} | ${failures || '—'} | ${run.latencyMs ?? '—'} ms |`;
    }),
    '',
  ];
  return lines.join('\n');
}
