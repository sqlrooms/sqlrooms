import {useSortable} from '@dnd-kit/sortable';
import {Badge as UiBadge, cn} from '@sqlrooms/ui';
import {GripVerticalIcon, XIcon} from 'lucide-react';
import type {FC} from 'react';
import {ContextSelectorItemIcon} from './ContextSelectorItemIcon';
import type {ContextSelectorItem} from './types';

type ContextSelectorSortableChipProps = {
  item: ContextSelectorItem;
  main: boolean;
  onMakeMain: (itemId: string) => void;
  onRemove: (itemId: string) => void;
};

export const ContextSelectorSortableChip: FC<
  ContextSelectorSortableChipProps
> = ({item, main, onMakeMain, onRemove}) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: item.id});

  const transformStyle = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(
        transform.y,
      )}px, 0)`
    : undefined;

  return (
    <span
      ref={setNodeRef}
      className={cn('inline-flex min-w-0', isDragging && 'opacity-70')}
      style={{
        transform: transformStyle,
        transition,
      }}
    >
      <UiBadge
        variant={main ? 'default' : 'secondary'}
        className="h-6 max-w-36 min-w-0 gap-1 px-1.5 text-[11px]"
      >
        <button
          type="button"
          className="text-muted-foreground/80 hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing"
          aria-label={`Drag ${item.title} to reorder context`}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          className="flex min-w-0 items-center gap-1"
          onClick={() => onMakeMain(item.id)}
          aria-label={`Make ${item.title} the main context item`}
        >
          <span className="shrink-0">
            <ContextSelectorItemIcon item={item} className="h-3 w-3" />
          </span>
          <span className="truncate">{item.title}</span>
        </button>
        <button
          type="button"
          className="ml-0.5 shrink-0 opacity-70 hover:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(item.id);
          }}
          aria-label={`Remove ${item.title} from context`}
        >
          <XIcon className="h-2.5 w-2.5" />
        </button>
      </UiBadge>
    </span>
  );
};
