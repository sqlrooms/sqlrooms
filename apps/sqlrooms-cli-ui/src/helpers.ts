import type {FileSystemTree} from '@webcontainer/api';
import {scaffolds} from '../app-scaffolds/scaffolds.generated.json';

type ScaffoldFileNode = {
  file: {contents: string; encoding?: 'utf-8' | 'base64'};
};
type ScaffoldDirectoryNode = {directory: ScaffoldTree};
type ScaffoldTreeNode = ScaffoldFileNode | ScaffoldDirectoryNode;
type ScaffoldTree = Record<string, ScaffoldTreeNode>;

/**
 * Decodes a base64 string into bytes for WebContainer file contents.
 */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

/**
 * Converts the generated scaffold tree shape into a WebContainer `FileSystemTree`.
 */
export function toFileSystemTree(tree: ScaffoldTree): FileSystemTree {
  const result: FileSystemTree = {};
  for (const [name, node] of Object.entries(tree)) {
    if ('directory' in node) {
      result[name] = {directory: toFileSystemTree(node.directory)};
      continue;
    }
    if (node.file.encoding === 'base64') {
      result[name] = {
        file: {contents: decodeBase64ToBytes(node.file.contents)},
      };
      continue;
    }
    result[name] = {file: {contents: node.file.contents}};
  }
  return result;
}

/**
 * Returns the default `get-started` scaffold as a WebContainer file tree.
 */
export function getDefaultScaffoldTree(): FileSystemTree {
  const getStarted = (scaffolds as {scaffolds?: Record<string, ScaffoldTree>})
    .scaffolds?.['get-started'];
  if (!getStarted) return {};
  return toFileSystemTree(getStarted);
}
