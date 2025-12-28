import {FileSystemTree} from '@webcontainer/api';

/**
 * Normalize a POSIX path by removing a leading slash and collapsing empties.
 */
export function normalizePath(path: string): string {
  return (path.startsWith('/') ? path.slice(1) : path).replace(/\\+/g, '/');
}

/**
 * Split a path into non-empty segments after normalization.
 */
export function pathToSegments(path: string): string[] {
  const normalized = normalizePath(path);
  return normalized.split('/').filter(Boolean);
}

/**
 * Type guard: whether a node is a directory entry.
 */
export function isDirectoryNode(
  node: unknown,
): node is {directory: FileSystemTree} {
  return !!node && typeof node === 'object' && 'directory' in (node as any);
}

/**
 * Type guard: whether a node is a file entry.
 */
export function isFileNode(node: unknown): node is {file: {contents: unknown}} {
  return !!node && typeof node === 'object' && 'file' in (node as any);
}

/**
 * Create a new FileSystemTree with the given file path set to the provided content.
 * Does not mutate the input tree.
 *
 * If intermediate directories don't exist, they are created.
 */
export function setFileContentInTree(
  tree: FileSystemTree,
  path: string,
  content: string,
): FileSystemTree {
  const segments = pathToSegments(path);

  const update = (subtree: FileSystemTree, index: number): FileSystemTree => {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    const existing = (subtree as any)[segment];

    if (isLast) {
      const newEntry = {file: {contents: content}};
      return {...subtree, [segment]: newEntry};
    }

    let nextDirTree: FileSystemTree;
    if (existing && isDirectoryNode(existing)) {
      nextDirTree = existing.directory;
    } else {
      nextDirTree = {};
    }

    const updatedChild = update(nextDirTree, index + 1);
    const newDirEntry = {directory: updatedChild};
    return {...subtree, [segment]: newDirEntry};
  };

  if (segments.length === 0) return tree;
  return update(tree ?? {}, 0);
}
