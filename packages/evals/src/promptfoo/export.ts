import {mkdir, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {renderObservatoryMarkdown} from './markdown';
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
  await mkdir(dirname(markdown), {recursive: true});
  await writeFile(markdown, renderObservatoryMarkdown(exported));
}
