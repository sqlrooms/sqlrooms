import {mkdir, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {summarizeObservatoryRuns} from './readModel';
import {exportPromptfooSqlite} from './sqlite';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const database = argument('--database');
const output = argument('--output');
const markdown = argument('--markdown');
if (!database || !output) {
  throw new Error(
    'Usage: pnpm evals:export --database <promptfoo.db> --output <summary.json> [--markdown <summary.md>]',
  );
}

const exported = exportPromptfooSqlite(database);
await mkdir(dirname(output), {recursive: true});
await writeFile(output, `${JSON.stringify(exported, null, 2)}\n`);

if (markdown) {
  const summary = summarizeObservatoryRuns(exported.runs);
  const lines = [
    '# SQLRooms behavioral eval summary',
    '',
    `- Exported: ${exported.exportedAt}`,
    `- Runs: ${summary.runCount}`,
    `- Passed: ${summary.passed}`,
    `- Failed/errors: ${summary.failed}`,
    `- Pass rate: ${(summary.passRate * 100).toFixed(1)}%`,
    `- Commit: ${exported.runs[0]?.repository.commitSha ?? 'unknown'}`,
    `- Profile: ${exported.runs[0]?.profile.name ?? 'unknown'}@${exported.runs[0]?.profile.version ?? 'unknown'}`,
    `- Model: ${exported.runs[0]?.model.modelId ?? 'unknown'}`,
    `- Workflow: ${exported.runs[0]?.repository.workflowUrl ?? 'local'}`,
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
  await mkdir(dirname(markdown), {recursive: true});
  await writeFile(markdown, lines.join('\n'));
}
