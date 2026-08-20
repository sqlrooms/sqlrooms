import {type DragEndEvent, useDndMonitor, useDroppable} from '@dnd-kit/core';
import {Slot} from '@sqlrooms/ui';
import {forwardRef, useCallback, type ComponentPropsWithoutRef} from 'react';
import {mergeRefs} from './mergeRefs';

/**
 * Props for {@link DropTarget}.
 */
export type ChatComposerDropTargetProps = ComponentPropsWithoutRef<'div'> & {
  /** Render as the single child element instead of a `<div>`, via Radix's `Slot`. */
  asChild?: boolean;
  /** A dnd-kit droppable id, unique within the surrounding dnd-kit context. */
  id: string;
  /** Whether the item currently being dragged may be dropped here. */
  canAccept: (data: unknown) => boolean;
  /** Called with the dragged item's data when an accepted drop lands. */
  onDrop: (data: unknown) => void;
};

/**
 * Marks an element as a drop target for in-app context items being dragged
 * into the composer — the one primitive that carries a ref and drag state a
 * plain `<div>` cannot.
 *
 * **This handles in-app context items only, not file uploads.** It is
 * dnd-kit based: dnd-kit's sensors observe pointer-driven drag gestures
 * between elements it manages, not the browser's native HTML5 file-drag
 * events fired when a file is dragged in from the OS. A file drop needs a
 * separate primitive built on native drag events, not this one.
 *
 * While an accepted drag is over the element, `data-drop-active` is present
 * on the rendered element so a host can style the hover state without this
 * component owning any visual classes itself.
 */
export const DropTarget = forwardRef<
  HTMLDivElement,
  ChatComposerDropTargetProps
>(function DropTarget({asChild, id, canAccept, onDrop, ...rest}, forwardedRef) {
  const {active, isOver, setNodeRef} = useDroppable({
    id,
    data: {roomDndPriority: 100},
  });
  const activeDropData = active?.data.current;
  const isAcceptedOver = Boolean(
    isOver && activeDropData && canAccept(activeDropData),
  );

  const isPointerWithinTarget = useCallback(
    (event: DragEndEvent) =>
      Boolean(
        event.collisions?.some(
          (collision) =>
            collision.id === id && collision.data?.pointerWithin === true,
        ),
      ),
    [id],
  );

  useDndMonitor({
    onDragEnd: (event) => {
      if (event.over?.id !== id || !isPointerWithinTarget(event)) return;
      const data = event.active.data.current;
      if (canAccept(data)) {
        onDrop(data);
      }
    },
  });

  const ref = mergeRefs(setNodeRef, forwardedRef);
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      ref={ref}
      data-drop-active={isAcceptedOver ? '' : undefined}
      {...rest}
    />
  );
});
