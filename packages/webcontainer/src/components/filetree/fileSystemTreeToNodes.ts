import {DirectoryNode, FileSystemTree} from '@webcontainer/api';
import {TreeNodeData} from '@sqlrooms/ui';

export type FileNodeObject = {
  type: 'directory' | 'file';
  name: string;
  path: string;
};

function isDirectory(value: FileSystemTree[string]): value is DirectoryNode {
  return 'directory' in value && value.directory !== undefined;
}

function joinPath(base: string, name: string): string {
  if (base === '/') return `/${name}`;
  const normalizedBase = base.replace(/\/+$/, '');
  return `${normalizedBase}/${name}`;
}

export function fileSystemTreeToNodes(
  tree: FileSystemTree,
  basePath: string,
  rootName: string = 'Files',
): TreeNodeData<FileNodeObject> {
  const toChildren = (
    subtree: FileSystemTree,
    currentBasePath: string,
  ): TreeNodeData<FileNodeObject>[] => {
    const entries = Object.entries(subtree).sort((a, b) => {
      const aIsDirectory = isDirectory(a[1]);
      const bIsDirectory = isDirectory(b[1]);
      if (aIsDirectory && !bIsDirectory) return -1;
      if (!aIsDirectory && bIsDirectory) return 1;
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([name, value]) => {
      const path = joinPath(currentBasePath, name);
      if (isDirectory(value)) {
        return {
          key: path,
          object: {type: 'directory', name, path},
          isInitialOpen: true,
          children: toChildren(value.directory, path),
        };
      }
      return {
        key: path,
        object: {type: 'file', name, path},
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
