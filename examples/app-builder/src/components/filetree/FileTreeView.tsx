import {cn, Tree, TreeNodeData} from '@sqlrooms/ui';
import {File as FileIcon} from 'lucide-react';
import {FC, useMemo} from 'react';
import {useRoomStore} from '../../store/store';
import {FileNodeObject, fileSystemTreeToNodes} from './fileSystemTreeToNodes';
import {BaseTreeNode} from '@sqlrooms/schema-tree';

/**
 * Default renderer for a file tree node.
 */
export const renderFileTreeNode = (
  node: TreeNodeData<FileNodeObject>,
  _isOpen: boolean,
) => {
  const {object} = node;
  const openFile = useRoomStore((s) => s.wc.openFile);
  return (
    <BaseTreeNode asChild className={cn('h-[22px]')} nodeObject={object}>
      {object.type === 'directory' ? (
        <div className="text-foreground/50 flex items-center truncate">
          {object.name}
        </div>
      ) : (
        <div
          className="flex items-center gap-1 py-0.5"
          onClick={() => {
            openFile(object.path);
          }}
        >
          <div>
            <FileIcon size={14} className="text-muted-foreground" />
          </div>
          <span className="text-foreground/50 truncate">{object.name}</span>
        </div>
      )}
    </BaseTreeNode>
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
}> = ({className, renderNode = renderFileTreeNode}) => {
  const filesTree = useRoomStore((s) => s.wc.filesTree);
  const rootNode = useMemo(
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
      <Tree treeData={rootNode} renderNode={renderNode} />
    </div>
  );
};
