import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  Button,
  cn,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import {useCallback, type FC} from 'react';
import {useContextSelectorContext} from './ContextSelectorContext';
import {ContextSelectorSortableChip} from './ContextSelectorSortableChip';
import type {ContextSelectorBadgeProps} from './types';

export const ContextSelectorBadge: FC<ContextSelectorBadgeProps> = ({
  className,
  tooltip,
  emptyLabel = 'Add context',
  addLabel = 'Add context',
}) => {
  const {
    selectedItems,
    runningItems,
    renderBadgeLabel,
    removeItem,
    makeMain,
    reorderItems,
  } = useContextSelectorContext();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {distance: 4},
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const mainItem = selectedItems[0];
  const label =
    renderBadgeLabel?.({mainItem, selectedItems, runningItems}) ??
    mainItem?.title ??
    emptyLabel;
  const tooltipContent =
    tooltip ??
    (runningItems.length > 0 ? 'Next request context' : 'Add context');

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {active, over} = event;
      if (!over || active.id === over.id) {
        return;
      }

      reorderItems(String(active.id), String(over.id));
    },
    [reorderItems],
  );

  return (
    <div
      className={cn(
        'flex max-w-full min-w-0 flex-wrap items-center gap-1',
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-6 w-6 shrink-0"
              aria-label={addLabel}
            >
              <PlusIcon className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-60 text-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
      {selectedItems.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={selectedItems.map((item) => item.id)}
            strategy={horizontalListSortingStrategy}
          >
            {selectedItems.map((item, index) => (
              <ContextSelectorSortableChip
                key={item.id}
                item={item}
                main={index === 0}
                onMakeMain={makeMain}
                onRemove={removeItem}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        <span className="text-muted-foreground truncate text-[11px]">
          {label}
        </span>
      )}
    </div>
  );
};
