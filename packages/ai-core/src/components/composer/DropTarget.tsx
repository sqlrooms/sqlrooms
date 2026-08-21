import {type DragEndEvent, useDndMonitor, useDroppable} from '@dnd-kit/core';
import {Slot} from '@sqlrooms/ui';
import {
  forwardRef,
  useCallback,
  useMemo,
  type ComponentPropsWithoutRef,
} from 'react';
import {mergeRefs} from '../primitives/mergeRefs';

/**
 * Droppable priority for composer drop targets, used by the room's dnd-kit
 * collision resolution to prefer the composer over enclosing droppables.
 */
const COMPOSER_DROP_PRIORITY = 100;

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
 * Marks an element as a drop target for in-app context items dragged into the
 * composer — the one primitive carrying a ref and drag state a plain `<div>`
 * cannot.
 *
 * **In-app context items only, not file uploads.** dnd-kit observes
 * pointer-driven drags between elements it manages, not the browser's native
 * HTML5 file-drag events. A file drop needs a separate primitive built on
 * native drag events.
 *
 * While an accepted drag is over the element, `data-drop-active` is present,
 * so a host can style the hover state (e.g. Tailwind's
 * `data-[drop-active]:…`) without this component owning visual classes.
 */
export const DropTarget = forwardRef<
  HTMLDivElement,
  ChatComposerDropTargetProps
>(function DropTarget({asChild, id, canAccept, onDrop, ...rest}, forwardedRef) {
  const {active, isOver, setNodeRef} = useDroppable({
    id,
    data: {roomDndPriority: COMPOSER_DROP_PRIORITY},
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

  // Memoized: a fresh callback ref would detach and reattach every render.
  const ref = useMemo(
    () => mergeRefs(setNodeRef, forwardedRef),
    [setNodeRef, forwardedRef],
  );
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      ref={ref}
      data-drop-active={isAcceptedOver ? '' : undefined}
      {...rest}
    />
  );
});
