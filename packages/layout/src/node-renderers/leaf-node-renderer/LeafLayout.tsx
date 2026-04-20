import {useDraggable, useDroppable} from '@dnd-kit/core';
import {CSS} from '@dnd-kit/utilities';
import {GripHorizontalIcon} from 'lucide-react';
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

interface RootProps {
  node: LayoutPanelNode | LayoutNodeKey;
  path: LayoutPath;
}

export const Root: FC<RootProps> = ({node, path}) => {
  const panelId = getLayoutNodeId(node);
  const {rootLayout} = useDockingContext();
  const panelInfo = useGetPanel(node);
  const dockable = isDockablePanel(rootLayout, panelId);
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
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
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
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
          <div
            className="absolute top-0 right-0 left-0 z-10 flex h-8 items-start justify-center"
            {...attributes}
            {...listeners}
          >
            <div
              className="border-border/70 bg-background/95 text-muted-foreground mt-1.5 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              aria-label={`Drag ${title}`}
            >
              <GripHorizontalIcon className="h-3 w-3" />
              <span className="max-w-[160px] truncate">{title}</span>
            </div>
          </div>
        )}
        <div className="h-full w-full overflow-hidden p-2">
          <RendererSwitcher />
        </div>
      </div>
    </LayoutNodeProvider>
  );
};

export const LeafLayout = {
  Root,
};
