import {cn, Tree, TreeNodeData} from '@sqlrooms/ui';
import {File as FileIcon, Folder, FolderOpen} from 'lucide-react';
import {FC, useMemo} from 'react';
import {useRoomStore} from '../../store/store';
import {FileNodeObject, fileSystemTreeToNodes} from './fileSystemTreeToNodes';

/**
 * Default renderer for a file tree node.
 */
export const defaultRenderFileTreeNode = (
  node: TreeNodeData<FileNodeObject>,
  isOpen: boolean,
) => {
  const {object} = node;
  if (object.type === 'directory') {
    return (
      <div className="text-foreground/50 flex items-center truncate">
        {object.name}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 py-0.5">
      <div>
        <FileIcon size={14} className="text-muted-foreground" />
      </div>
      <span className="text-foreground/50 truncate">{object.name}</span>
    </div>
  );
};

/**
 * Renders the WebContainer files tree using the generic Tree component.
 */
export const FileTreeView: FC<{
  className?: string;
  renderNode?: (
    node: TreeNodeData<FileNodeObject>,
    isOpen: boolean,
  ) => React.ReactNode;
}> = ({className, renderNode = defaultRenderFileTreeNode}) => {
  const filesTree = useRoomStore((s) => s.wc.filesTree);
  const roots = useMemo(
    () => fileSystemTreeToNodes(filesTree, '/'),
    [filesTree],
  );
  return (
    <div
      className={cn(
        'flex h-full w-full select-none flex-col overflow-auto p-2 text-sm',
        className,
      )}
    >
      {roots.map((subtree) => (
        <Tree key={subtree.key} treeData={subtree} renderNode={renderNode} />
      ))}
    </div>
  );
};
