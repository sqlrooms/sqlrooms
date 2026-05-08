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
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import {
  Badge as UiBadge,
  Button,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {
  BarChart3Icon,
  BoxesIcon,
  GripVerticalIcon,
  MapIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import {
  createContext,
  type FC,
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export const CHAT_CONTEXT_SELECTOR_SLOT = Symbol.for(
  'sqlrooms.ai.contextSelectorSlot',
);

export type ContextSelectorItem = {
  id: string;
  kind: string;
  title: string;
  type?: string;
  subtitle?: string;
  disabled?: boolean;
  missing?: boolean;
  keywords?: string[];
};

type RenderItemArgs = {
  item: ContextSelectorItem;
  selected: boolean;
  main: boolean;
  running: boolean;
};

export type ContextSelectorRootProps = PropsWithChildren<{
  items: ContextSelectorItem[];
  selectedIds: string[];
  onSelectedIdsChange: (nextIds: string[]) => void;
  runningContextIds?: string[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  renderIcon?: (item: ContextSelectorItem) => ReactNode;
  renderItem?: (args: RenderItemArgs) => ReactNode;
  renderBadgeLabel?: (args: {
    mainItem: ContextSelectorItem | undefined;
    selectedItems: ContextSelectorItem[];
    runningItems: ContextSelectorItem[];
  }) => ReactNode;
}>;

type ContextSelectorBadgeProps = {
  className?: string;
  tooltip?: ReactNode;
  emptyLabel?: ReactNode;
  addLabel?: string;
};

type ContextSelectorSearchDropdownProps = {
  className?: string;
  align?: 'start' | 'center' | 'end';
  searchPlaceholder?: string;
  emptyLabel?: ReactNode;
};

type ContextSelectorContextValue = Omit<
  ContextSelectorRootProps,
  'children' | 'open' | 'defaultOpen' | 'onOpenChange' | 'className'
> & {
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedItems: ContextSelectorItem[];
  runningItems: ContextSelectorItem[];
  displayItems: ContextSelectorItem[];
  toggleItem: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  makeMain: (itemId: string) => void;
  reorderItems: (activeId: string, overId: string) => void;
};

type ContextSelectorComponent = FC<ContextSelectorRootProps> & {
  Badge: FC<ContextSelectorBadgeProps>;
  SearchDropdown: FC<ContextSelectorSearchDropdownProps>;
};

const ContextSelectorContext = createContext<
  ContextSelectorContextValue | undefined
>(undefined);

function useContextSelectorContext() {
  const context = useContext(ContextSelectorContext);
  if (!context) {
    throw new Error(
      'Chat.ContextSelector compound components must be rendered inside Chat.ContextSelector.',
    );
  }
  return context;
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

export function toggleContextSelectorItem(
  selectedIds: string[],
  itemId: string,
) {
  return selectedIds.includes(itemId)
    ? selectedIds.filter((id) => id !== itemId)
    : [...selectedIds, itemId];
}

export function promoteContextSelectorItem(
  selectedIds: string[],
  itemId: string,
) {
  return [itemId, ...selectedIds.filter((id) => id !== itemId)];
}

export function reorderContextSelectorItems(
  selectedIds: string[],
  activeId: string,
  overId: string,
) {
  const oldIndex = selectedIds.indexOf(activeId);
  const newIndex = selectedIds.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return selectedIds;
  }
  return arrayMove(selectedIds, oldIndex, newIndex);
}

function getKnownItems(items: ContextSelectorItem[], ids: string[]) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return ids
    .map((id) => itemsById.get(id))
    .filter(Boolean) as ContextSelectorItem[];
}

function getDefaultIcon(item: ContextSelectorItem) {
  if (item.kind === 'artifact' && item.type === 'map') return MapIcon;
  if (item.kind === 'artifact' && item.type === 'dashboard')
    return BarChart3Icon;
  return BoxesIcon;
}

function defaultTypeLabel(item: ContextSelectorItem) {
  return item.type ?? item.kind;
}

const Root: FC<ContextSelectorRootProps> = ({
  children,
  items,
  selectedIds,
  onSelectedIdsChange,
  runningContextIds,
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  renderIcon,
  renderItem,
  renderBadgeLabel,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );
  const normalizedSelectedIds = useMemo(
    () => uniqueIds(selectedIds),
    [selectedIds],
  );
  const normalizedRunningIds = useMemo(
    () => uniqueIds(runningContextIds ?? []),
    [runningContextIds],
  );
  const selectedItems = useMemo(
    () => getKnownItems(items, normalizedSelectedIds),
    [items, normalizedSelectedIds],
  );
  const runningItems = useMemo(
    () => getKnownItems(items, normalizedRunningIds),
    [items, normalizedRunningIds],
  );
  const displayItems = runningContextIds ? runningItems : selectedItems;

  const value = useMemo<ContextSelectorContextValue>(
    () => ({
      items,
      selectedIds: normalizedSelectedIds,
      onSelectedIdsChange,
      runningContextIds,
      renderIcon,
      renderItem,
      renderBadgeLabel,
      open: actualOpen,
      setOpen,
      selectedItems,
      runningItems,
      displayItems,
      toggleItem: (itemId) => {
        onSelectedIdsChange(
          toggleContextSelectorItem(normalizedSelectedIds, itemId),
        );
      },
      removeItem: (itemId) => {
        onSelectedIdsChange(
          normalizedSelectedIds.filter((id) => id !== itemId),
        );
      },
      makeMain: (itemId) => {
        onSelectedIdsChange(
          promoteContextSelectorItem(normalizedSelectedIds, itemId),
        );
      },
      reorderItems: (activeId, overId) => {
        onSelectedIdsChange(
          reorderContextSelectorItems(normalizedSelectedIds, activeId, overId),
        );
      },
    }),
    [
      items,
      normalizedSelectedIds,
      onSelectedIdsChange,
      runningContextIds,
      renderIcon,
      renderItem,
      renderBadgeLabel,
      actualOpen,
      setOpen,
      selectedItems,
      runningItems,
      displayItems,
    ],
  );

  return (
    <ContextSelectorContext.Provider value={value}>
      <TooltipProvider delayDuration={250}>
        <Popover open={actualOpen} onOpenChange={setOpen}>
          <div className={cn('inline-flex max-w-full min-w-0', className)}>
            {children}
          </div>
        </Popover>
      </TooltipProvider>
    </ContextSelectorContext.Provider>
  );
};

const Badge: FC<ContextSelectorBadgeProps> = ({
  className,
  tooltip,
  emptyLabel = 'Add context',
  addLabel = 'Add context',
}) => {
  const {
    selectedItems,
    runningItems,
    renderIcon,
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
    (runningItems.length > 0
      ? 'Next request context'
      : 'Add context');

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
          onDragEnd={(event: DragEndEvent) => {
            const {active, over} = event;
            if (!over || active.id === over.id) return;
            reorderItems(String(active.id), String(over.id));
          }}
        >
          <SortableContext
            items={selectedItems.map((item) => item.id)}
            strategy={horizontalListSortingStrategy}
          >
            {selectedItems.map((item, index) => (
              <SortableContextChip
                key={item.id}
                item={item}
                main={index === 0}
                renderIcon={renderIcon}
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

const SortableContextChip: FC<{
  item: ContextSelectorItem;
  main: boolean;
  renderIcon?: (item: ContextSelectorItem) => ReactNode;
  onMakeMain: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}> = ({item, main, renderIcon, onMakeMain, onRemove}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({id: item.id});
  const Icon = getDefaultIcon(item);
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
            {renderIcon ? renderIcon(item) : <Icon className="h-3 w-3" />}
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

const SearchDropdown: FC<ContextSelectorSearchDropdownProps> = ({
  className,
  align = 'end',
  searchPlaceholder = 'Search context...',
  emptyLabel = 'No context item found.',
}) => {
  const {
    items,
    selectedIds,
    runningContextIds,
    setOpen,
    renderIcon,
    renderItem,
    toggleItem,
  } = useContextSelectorContext();
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const runningIdSet = useMemo(
    () => new Set(runningContextIds ?? []),
    [runningContextIds],
  );
  const availableItems = useMemo(
    () => items.filter((item) => !selectedIdSet.has(item.id)),
    [items, selectedIdSet],
  );

  return (
    <PopoverContent align={align} className={cn('w-72 p-0', className)}>
      <Command>
        <CommandInput placeholder={searchPlaceholder} />
        <CommandList>
          <CommandEmpty>{emptyLabel}</CommandEmpty>
          <CommandGroup>
            {availableItems.map((item) => {
              const running = runningIdSet.has(item.id);
              const Icon = getDefaultIcon(item);
              const keywords = [
                item.title,
                item.kind,
                item.type,
                item.subtitle,
                ...(item.keywords ?? []),
              ].filter(Boolean) as string[];

              return (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  keywords={keywords}
                  disabled={item.disabled}
                  onSelect={() => {
                    toggleItem(item.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 text-xs"
                >
                  {renderItem ? (
                    renderItem({item, selected: false, main: false, running})
                  ) : (
                    <>
                      <span className="shrink-0">
                        {renderIcon ? (
                          renderIcon(item)
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.title}</span>
                        {item.subtitle ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground text-xs capitalize">
                        {defaultTypeLabel(item)}
                      </span>
                      {running ? (
                        <UiBadge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px]"
                        >
                          Running
                        </UiBadge>
                      ) : null}
                    </>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
};

export const ContextSelector: ContextSelectorComponent = Object.assign(Root, {
  Badge,
  SearchDropdown,
  [CHAT_CONTEXT_SELECTOR_SLOT]: true,
}) as ContextSelectorComponent;
