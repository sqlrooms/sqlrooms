import {BaseTreeNode} from '@sqlrooms/schema-tree';
import {cn, Tree, TreeNodeData} from '@sqlrooms/ui';
import {File as FileIcon} from 'lucide-react';
import {FC, ReactNode, useMemo} from 'react';
import {useStoreWithWebContainer} from '../../WebContainerSlice';
import {FileNodeObject, fileSystemTreeToNodes} from './fileSystemTreeToNodes';

export const RenderFileTreeNode = (
  node: TreeNodeData<FileNodeObject>,
  _isOpen: boolean,
  options?: {onOpenFile?: (path: string) => void},
) => {
  const {object} = node;
  return (
    <BaseTreeNode asChild className={cn('h-5.5')} nodeObject={object}>
      {object.type === 'directory' ? (
        <div className="text-foreground/50 flex items-center truncate">
          {object.name}
        </div>
      ) : (
        <div
          className="flex items-center gap-1 py-0.5"
          onClick={() => {
            options?.onOpenFile?.(object.path);
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

export const FileTreeView: FC<{
  className?: string;
  renderNode?: (
    node: TreeNodeData<FileNodeObject>,
    isOpen: boolean,
  ) => ReactNode;
}> = ({className, renderNode}) => {
  const filesTree = useStoreWithWebContainer(
    (s) => s.webContainer.config.filesTree,
  );
  const openFile = useStoreWithWebContainer((s) => s.webContainer.openFile);
  const rootNode = useMemo(
    () => fileSystemTreeToNodes(filesTree, '/'),
    [filesTree],
  );
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col overflow-auto p-2 text-sm select-none',
        className,
      )}
    >
      <Tree
        treeData={rootNode}
        renderNode={
          renderNode ??
          ((node, isOpen) =>
            RenderFileTreeNode(node, isOpen, {
              onOpenFile: (path) => {
                void openFile(path);
              },
            }))
        }
      />
    </div>
  );
};
