import {promises as fs} from 'fs';
import * as path from 'path';

export async function generateScaffoldsModule(params: {
  scaffoldsRootDir: string;
  outputFile: string;
}): Promise<void> {
  const {scaffoldsRootDir, outputFile} = params;
  const scaffoldDirs = await listImmediateDirectories(scaffoldsRootDir);
  const scaffoldNames: string[] = [];
  const trees: Record<string, unknown> = {};
  const defaults: Record<
    string,
    {editableFilePath: string; editableFileContents: string}
  > = {};

  for (const dirName of scaffoldDirs) {
    const baseDir = path.join(scaffoldsRootDir, dirName);
    const {tree, editable} = await buildTreeForScaffold(baseDir);
    scaffoldNames.push(dirName);
    trees[dirName] = tree;
    defaults[dirName] = editable;
  }

  const payload = {
    names: scaffoldNames,
    scaffolds: trees,
    defaults,
  };
  await fs.mkdir(path.dirname(outputFile), {recursive: true});
  await fs.writeFile(
    outputFile,
    JSON.stringify(payload, null, 2) + '\n',
    'utf-8',
  );
}

async function listImmediateDirectories(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, {withFileTypes: true});
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function buildTreeForScaffold(baseDir: string): Promise<{
  tree: unknown;
  editable: {editableFilePath: string; editableFileContents: string};
}> {
  const tree = await buildDirectoryNode(baseDir);
  const editableRel =
    (await resolveEditablePath(baseDir, tree)) ?? 'src/App.jsx';
  let editableContents = '';
  try {
    editableContents = await fs.readFile(
      path.join(baseDir, editableRel),
      'utf-8',
    );
  } catch {
    editableContents = '';
  }
  return {
    tree,
    editable: {
      editableFilePath: '/' + editableRel,
      editableFileContents: editableContents,
    },
  };
}

type ScaffoldFileNode = {
  file: {contents: string; encoding?: 'utf-8' | 'base64'};
};
type ScaffoldDirectoryNode = {directory: DirectoryTree};
type ScaffoldTreeNode = ScaffoldFileNode | ScaffoldDirectoryNode;
type DirectoryTree = Record<string, ScaffoldTreeNode>;

async function resolveEditablePath(
  baseDir: string,
  tree: DirectoryTree,
): Promise<string | null> {
  const preferred = [
    'src/App.jsx',
    'src/App.tsx',
    'src/main.jsx',
    'src/main.tsx',
  ];
  for (const rel of preferred) {
    try {
      await fs.stat(path.join(baseDir, rel));
      return rel;
    } catch {
      // Keep looking for a fallback.
    }
  }

  return findFirstTextFile(tree);
}

function findFirstTextFile(tree: DirectoryTree, prefix = ''): string | null {
  const entries = Object.entries(tree);
  for (const [name, entry] of entries) {
    if ('file' in entry) {
      if (entry.file.encoding !== 'base64') {
        return `${prefix}${name}`;
      }
      continue;
    }
    const nested = findFirstTextFile(entry.directory, `${prefix}${name}/`);
    if (nested) return nested;
  }
  return null;
}

function looksBinary(data: Buffer): boolean {
  if (data.length === 0) return false;
  for (const byte of data) {
    if (byte === 0) return true;
  }
  return false;
}

async function buildDirectoryNode(dir: string): Promise<DirectoryTree> {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const result: DirectoryTree = {};
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result[entry.name] = {directory: await buildDirectoryNode(abs)};
    } else if (entry.isFile()) {
      const raw = await fs.readFile(abs);
      if (looksBinary(raw)) {
        result[entry.name] = {
          file: {contents: raw.toString('base64'), encoding: 'base64'},
        };
      } else {
        result[entry.name] = {
          file: {contents: raw.toString('utf-8'), encoding: 'utf-8'},
        };
      }
    }
  }
  return result;
}
