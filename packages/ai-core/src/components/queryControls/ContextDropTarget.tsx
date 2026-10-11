import {type DragEndEvent, useDndMonitor, useDroppable} from '@dnd-kit/core';
import {useCallback, type ReactNode, type Ref} from 'react';

/** A dnd-kit drop target for in-app context items dragged onto the composer. */
export type ContextDropTargetConfig = {
  id: string;
  canAccept: (data: unknown) => boolean;
  onDrop: (data: unknown) => void;
};

export type ContextDropTargetRenderArgs = {
  isAcceptedOver: boolean;
  setNodeRef?: Ref<HTMLDivElement>;
};

/**
 * Calls `children` with drag state, wiring up a dnd-kit droppable only when a
 * `target` is supplied.
 *
 * Duplicates the `DropTarget` composer primitive because the recipe needs
 * `isAcceptedOver` as a value to build its Tailwind classes, while the
 * primitive only emits `data-drop-active`. Resolving that (styling off the data
 * attribute) deletes this file — see the open-questions note for the spec.
 */
export function ContextDropTarget({
  target,
  children,
}: {
  target?: ContextDropTargetConfig;
  children: (args: ContextDropTargetRenderArgs) => ReactNode;
}) {
  if (!target) {
    return children({setNodeRef: undefined, isAcceptedOver: false});
  }
  return (
    <ActiveContextDropTarget target={target}>
      {children}
    </ActiveContextDropTarget>
  );
}

function ActiveContextDropTarget({
  target,
  children,
}: {
  target: ContextDropTargetConfig;
  children: (args: ContextDropTargetRenderArgs) => ReactNode;
}) {
  const {active, isOver, setNodeRef} = useDroppable({
    id: target.id,
    data: {roomDndPriority: 100},
  });
  const activeDropData = active?.data.current;
  const isAcceptedOver = Boolean(
    isOver && activeDropData && target.canAccept(activeDropData),
  );

  const isPointerWithinTarget = useCallback(
    (event: DragEndEvent) =>
      Boolean(
        event.collisions?.some(
          (collision) =>
            collision.id === target.id &&
            collision.data?.pointerWithin === true,
        ),
      ),
    [target.id],
  );

  useDndMonitor({
    onDragEnd: (event) => {
      if (event.over?.id !== target.id || !isPointerWithinTarget(event)) {
        return;
      }
      const data = event.active.data.current;
      if (target.canAccept(data)) {
        target.onDrop(data);
      }
    },
  });

  return children({setNodeRef, isAcceptedOver});
}
