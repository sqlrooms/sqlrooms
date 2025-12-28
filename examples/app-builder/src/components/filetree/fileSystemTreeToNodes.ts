import {TreeNodeData} from '@sqlrooms/ui';
import {FileSystemTree, DirectoryNode} from '@webcontainer/api';

export type FileNodeObject = {
  type: 'directory' | 'file';
  name: string;
  path: string;
};

export function isDirectory(
  value: FileSystemTree[string],
): value is DirectoryNode {
  return 'directory' in value && value.directory !== undefined;
}
/**
 * Convert WebContainer FileSystemTree into a single root TreeNodeData<FileNodeObject> suitable for Tree.
 */
export function fileSystemTreeToNodes(
  tree: FileSystemTree,
  basePath: string,
  rootName: string = 'Files',
): TreeNodeData<FileNodeObject> {
  const toChildren = (
    subtree: FileSystemTree,
    currentBasePath: string,
  ): TreeNodeData<FileNodeObject>[] => {
    const entries = Object.entries(subtree).sort((a, b) =>
      isDirectory(a[1]) ? -1 : a[0].localeCompare(b[0]),
    );
    return entries.map(([name, value]) => {
      const path =
        currentBasePath === '/' ? `/${name}` : `${currentBasePath}/${name}`;
      if (isDirectory(value)) {
        return {
          key: path,
          object: {type: 'directory', name: name, path: path},
          isInitialOpen: true,
          children: toChildren(value.directory, path),
        };
      }
      return {
        key: path,
        object: {type: 'file', name: name, path: path},
      };
    });
  };

  return {
    key: basePath,
    object: {type: 'directory', name: rootName, path: basePath},
    isInitialOpen: true,
    children: toChildren(tree, basePath),
  };
}
