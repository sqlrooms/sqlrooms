import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';

function findRepoRoot(start: string): string {
  let current = start;
  while (current !== dirname(current)) {
    const packageJson = join(current, 'package.json');
    if (
      existsSync(packageJson) &&
      JSON.parse(readFileSync(packageJson, 'utf8')).name === 'sqlrooms'
    ) {
      return current;
    }
    current = dirname(current);
  }
  throw new Error('Unable to find sqlrooms repository root.');
}

const repoRoot = findRepoRoot(process.cwd());
const sourceRoots = ['packages', 'apps', 'examples'];
const scannedExtensions = new Set(['.ts', '.tsx']);
const approvedFiles = new Set(['packages/duckdb-core/src/duckdb-utils.ts']);

const tableToStringPatterns = [
  /\bqualified(?:TableName|Name)?\.toString\(\)/,
  /\btableObj\.table\.toString\(\)/,
  /\btable\.table\.toString\(\)/,
  /\btableName\.toString\(\)/,
];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (
        entry === 'node_modules' ||
        entry === 'dist' ||
        entry === 'coverage' ||
        entry === '.turbo'
      ) {
        return [];
      }
      return walk(path);
    }
    return [path];
  });
}

describe('QualifiedTableName.toString allowlist', () => {
  it('keeps direct table-reference stringification in approved low-level files', () => {
    const violations = sourceRoots
      .flatMap((root) => walk(join(repoRoot, root)))
      .filter((path) =>
        [...scannedExtensions].some((extension) => path.endsWith(extension)),
      )
      .filter((path) => !path.includes('__tests__'))
      .flatMap((path) => {
        const relativePath = relative(repoRoot, path);
        if (approvedFiles.has(relativePath)) return [];

        const text = readFileSync(path, 'utf8');
        return tableToStringPatterns
          .filter((pattern) => pattern.test(text))
          .map((pattern) => `${relativePath} matched ${pattern.source}`);
      });

    expect(violations).toEqual([]);
  });
});
