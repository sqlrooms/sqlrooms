import {useDraggable, useDroppable} from '@dnd-kit/core';
import {FC, useCallback} from 'react';
import {
  getLayoutNodeId,
  LayoutNodeKey,
  LayoutPanelNode,
} from '@sqlrooms/layout-config';
import {RendererSwitcher} from '../RendererSwitcher';
import {LayoutNodeProvider} from '../../LayoutNodeContext';
import {LayoutPath} from '../../types';
import {useDockingContext} from '../../docking/DockingContext';
import {useGetPanel} from '../../useGetPanel';
import {isDockablePanel} from '../../layout-tree';
import {LeafLayoutDragHandle} from './LeafLayoutDragHandle';
import {LeafLayoutContent} from './LeafLayoutContent';

interface RootProps {
  node: LayoutPanelNode | LayoutNodeKey;
  path: LayoutPath;
}

const Root: FC<RootProps> = ({node, path}) => {
  const panelId = getLayoutNodeId(node);
  const {rootLayout} = useDockingContext();
  const panelInfo = useGetPanel(node);
  const dockable = isDockablePanel(rootLayout, panelId);
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    isDragging,
  } = useDraggable({
    id: panelId,
    disabled: !dockable,
  });
  const {setNodeRef: setDroppableNodeRef} = useDroppable({
    id: panelId,
    disabled: !dockable,
  });
  const setNodeRef = useCallback(
    (element: HTMLElement | null) => {
      setDraggableNodeRef(element);
      setDroppableNodeRef(element);
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  );
  const style = dockable
    ? {
        opacity: isDragging ? 0.3 : 1,
      }
    : undefined;
  const title = panelInfo?.title ?? panelId;

  return (
    <LayoutNodeProvider containerType="leaf" node={node} path={path}>
      <div
        ref={setNodeRef}
        style={style}
        className="group relative h-full w-full overflow-hidden"
      >
        {dockable && (
          <LeafLayout.DragHandle
            panelId={panelId}
            title={title}
            attributes={attributes}
            listeners={listeners}
          />
        )}
        <LeafLayout.Content>
          <RendererSwitcher />
        </LeafLayout.Content>
      </div>
    </LayoutNodeProvider>
  );
};

export const LeafLayout = {
  Root,
  DragHandle: LeafLayoutDragHandle,
  Content: LeafLayoutContent,
};
