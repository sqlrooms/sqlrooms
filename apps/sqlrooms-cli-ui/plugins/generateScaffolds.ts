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
  const editableRel = 'src/App.jsx';
  const editableContents = await fs.readFile(
    path.join(baseDir, editableRel),
    'utf-8',
  );
  return {
    tree,
    editable: {
      editableFilePath: '/' + editableRel,
      editableFileContents: editableContents,
    },
  };
}

async function buildDirectoryNode(dir: string): Promise<unknown> {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const result: Record<string, unknown> = {};
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result[entry.name] = {directory: await buildDirectoryNode(abs)};
    } else if (entry.isFile()) {
      result[entry.name] = {
        file: {contents: await fs.readFile(abs, 'utf-8')},
      };
    }
  }
  return result;
}
