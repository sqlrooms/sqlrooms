import {FC, useCallback} from 'react';
import {GripHorizontalIcon, XIcon} from 'lucide-react';
import {DraggableAttributes, useDraggable} from '@dnd-kit/core';
import {useLayoutRendererContext} from '../../LayoutRendererContext';
import {useDockingContext} from '../../docking/DockingContext';
import {removeLayoutNodeByKey} from '../../layout-tree';

type SyntheticListenerMap = ReturnType<typeof useDraggable>['listeners'];

export interface LeafLayoutDragHandleProps {
  panelId: string;
  title: string;
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap;
}

export const LeafLayoutDragHandle: FC<LeafLayoutDragHandleProps> = ({
  panelId,
  title,
  attributes,
  listeners,
}) => {
  const {rootLayout} = useDockingContext();
  const {onLayoutChange} = useLayoutRendererContext();

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onLayoutChange) return;

      const result = removeLayoutNodeByKey(rootLayout, panelId);
      if (result.success) {
        onLayoutChange(result.nextTree);
      }
    },
    [onLayoutChange, rootLayout, panelId],
  );

  return (
    <div className="absolute top-0 right-0 left-0 z-10 flex h-8 items-start justify-center">
      <div
        className="border-border/70 bg-background/95 text-muted-foreground mt-1.5 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        aria-label={`Drag ${title}`}
      >
        <div className="flex items-center gap-1" {...attributes} {...listeners}>
          <GripHorizontalIcon className="h-3 w-3" />
          <span className="max-w-[160px] truncate">{title}</span>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="hover:text-foreground -mr-0.5 ml-1 transition-colors"
          aria-label={`Close ${title}`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
