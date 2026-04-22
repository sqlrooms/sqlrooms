import {useDraggable, useDroppable} from '@dnd-kit/core';
import {FC, PropsWithChildren, useCallback, useMemo} from 'react';
import {getLayoutNodeId} from '@sqlrooms/layout-config';
import {useLayoutNodeContext} from '../../LayoutNodeContext';
import {cn} from '@sqlrooms/ui';
import {LeafLayoutPanelDraggableProvider} from './LeafLayoutPanelDraggableContext';
import {useIsDockablePanel} from './useIsDockable';

export const LeafLayoutPanel: FC<PropsWithChildren> = ({children}) => {
  const {node} = useLayoutNodeContext();

  const panelId = getLayoutNodeId(node);

  const isDockablePanel = useIsDockablePanel();

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    isDragging,
  } = useDraggable({
    id: panelId,
    disabled: !isDockablePanel,
  });

  const {setNodeRef: setDroppableNodeRef} = useDroppable({
    id: panelId,
    disabled: !isDockablePanel,
  });

  const setNodeRef = useCallback(
    (element: HTMLElement | null) => {
      setDraggableNodeRef(element);
      setDroppableNodeRef(element);
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  );

  const contextValue = useMemo(
    () => ({
      attributes,
      listeners,
    }),
    [attributes, listeners],
  );

  return (
    <LeafLayoutPanelDraggableProvider value={contextValue}>
      <div
        ref={setNodeRef}
        className={cn(
          'group relative flex h-full w-full flex-col overflow-hidden',
          {
            'opacity-30': isDockablePanel && isDragging,
            'opacity-100': isDockablePanel && !isDragging,
          },
        )}
      >
        {children}
      </div>
    </LeafLayoutPanelDraggableProvider>
  );
};
