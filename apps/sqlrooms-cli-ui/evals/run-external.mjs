import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {superviseExternalWorker} from './supervise-external.mjs';
const script = fileURLToPath(import.meta.url);
const directory = path.dirname(script);
const worker = process.argv[2] === '--worker';
const requestedDir = process.argv[worker ? 3 : 2];
if (!requestedDir)
  throw new Error(
    'Usage: node evals/run-external.mjs <new-evidence-directory>',
  );
const outputDir = path.resolve(requestedDir);
const controller = new AbortController();
const cancel = () => controller.abort();
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
try {
  if (!worker) {
    process.exitCode = await superviseExternalWorker({
      workerPath: script,
      outputDir,
      signal: controller.signal,
    });
  } else {
    const {runExternalSuite} =
      await import('./external-dist/runExternalSuite.mjs');
    const results = await runExternalSuite({
      outputDir,
      skillDir: path.resolve(directory, '../skills/sqlrooms'),
      model: process.env.SQLROOMS_EVAL_MODEL,
      modelProvider: process.env.SQLROOMS_EVAL_PROVIDER,
      signal: controller.signal,
      onResource: (resource) => process.send?.(resource),
    });
    console.log(
      results
        .map(
          (result) =>
            `${result.scenario.id}@${result.scenario.version}: ${result.status}`,
        )
        .join('\n'),
    );
    if (
      results.length !== 2 ||
      results.some((result) => result.status !== 'passed')
    )
      process.exitCode = 1;
  }
} finally {
  process.off('SIGINT', cancel);
  process.off('SIGTERM', cancel);
}
