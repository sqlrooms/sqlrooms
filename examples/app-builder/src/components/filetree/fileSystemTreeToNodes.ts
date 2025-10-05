import {FileSystemTree, DirectoryNode} from '@webcontainer/api';

export type FileNodeObject = {
  type: 'directory' | 'file';
  name: string;
  path: string;
};

export type TreeNodeData<T> = {
  key: string;
  object: T;
  children?: TreeNodeData<T>[];
  isInitialOpen?: boolean;
};

export function isDirectory(
  value: FileSystemTree[string],
): value is DirectoryNode {
  return 'directory' in value && value.directory !== undefined;
}
/**
 * Convert WebContainer FileSystemTree into TreeNodeData<FileNodeObject>[] suitable for Tree.
 */
export function fileSystemTreeToNodes(
  tree: FileSystemTree,
  basePath: string,
): TreeNodeData<FileNodeObject>[] {
  const entries = Object.entries(tree).sort((a, b) =>
    isDirectory(a[1]) ? -1 : a[0].localeCompare(b[0]),
  );
  return entries.map(([name, value]) => {
    const path = basePath === '/' ? `/${name}` : `${basePath}/${name}`;
    if (isDirectory(value)) {
      return {
        key: path,
        object: {type: 'directory', name: name, path: path},
        isInitialOpen: true,
        children: fileSystemTreeToNodes(value.directory, path),
      };
    }
    return {
      key: path,
      object: {type: 'file', name: name, path: path},
    };
  });
}
