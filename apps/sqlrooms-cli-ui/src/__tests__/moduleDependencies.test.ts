import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import ts from 'typescript';

const SOURCE_ROOT = resolve(process.cwd(), 'src');
const SOURCE_EXTENSIONS = ['.ts', '.tsx'] as const;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : collectSourceFiles(path);
    }
    return SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))
      ? [path]
      : [];
  });
}

function resolveLocalImport(
  importingFile: string,
  moduleSpecifier: string,
  sourceFiles: ReadonlySet<string>,
): string | undefined {
  if (!moduleSpecifier.startsWith('.')) return undefined;
  const basePath = resolve(dirname(importingFile), moduleSpecifier);
  return [
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) =>
      join(basePath, `index${extension}`),
    ),
  ].find((candidate) => sourceFiles.has(candidate));
}

function getLocalImports(
  file: string,
  sourceFiles: ReadonlySet<string>,
): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  return source.statements.flatMap((statement) => {
    const isRuntimeImport =
      ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly;
    const isRuntimeExport =
      ts.isExportDeclaration(statement) && !statement.isTypeOnly;
    if (!isRuntimeImport && !isRuntimeExport) return [];
    if (
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return [];
    }
    const importedFile = resolveLocalImport(
      file,
      statement.moduleSpecifier.text,
      sourceFiles,
    );
    return importedFile ? [importedFile] : [];
  });
}

function findCircularDependencies(
  graph: ReadonlyMap<string, string[]>,
): string[][] {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  function visit(file: string) {
    if (active.has(file)) {
      const cycleStart = stack.indexOf(file);
      cycles.push([...stack.slice(cycleStart), file]);
      return;
    }
    if (visited.has(file)) return;

    active.add(file);
    stack.push(file);
    for (const dependency of graph.get(file) ?? []) {
      visit(dependency);
    }
    stack.pop();
    active.delete(file);
    visited.add(file);
  }

  for (const file of graph.keys()) visit(file);
  return cycles;
}

test('CLI UI source modules have no circular runtime dependencies', () => {
  const files = collectSourceFiles(SOURCE_ROOT);
  const sourceFiles = new Set(files);
  const graph = new Map(
    files.map((file) => [file, getLocalImports(file, sourceFiles)]),
  );
  const cycles = findCircularDependencies(graph).map((cycle) =>
    cycle.map((file) => relative(SOURCE_ROOT, file)).join(' -> '),
  );

  expect(cycles).toEqual([]);
});
