import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  ListCollapseIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const DRAG_MODIFIERS = [restrictToHorizontalAxis, restrictToParentElement];

import {cn} from '../lib/utils';
import {Button} from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import {EditableText} from './editable-text';
import {Input} from './input';
import {Tabs, TabsList, TabsTrigger} from './tabs';

export interface TabDescriptor {
  id: string;
  name: string;
  [key: string]: unknown;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface TabStripContextValue {
  // Data
  openTabs: TabDescriptor[];
  closedTabs: TabDescriptor[];
  closedTabIds: Set<string>;
  filteredTabs: TabDescriptor[];
  editingTabId: string | null;
  search: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  selectedTabId?: string | null;

  // Callbacks
  onOpen?: (tabId: string) => void;
  onSelect?: (tabId: string) => void;
  onCreate?: () => void;
  onRename?: (tabId: string, newName: string) => void;
  onRenameRequest?: (tabId: string) => void;
  onDelete?: (tabId: string) => void;
  onReorder?: (tabIds: string[]) => void;

  // Internal handlers
  setSearch: (value: string) => void;
  handleStartEditing: (tabId: string) => void;
  handleStopEditing: () => void;
  handleInlineRename: (tabId: string, newName: string) => void;
  handleClose: (tabId: string) => void;
}

const TabStripContext = createContext<TabStripContextValue | null>(null);

function useTabStripContext() {
  const context = useContext(TabStripContext);
  if (!context) {
    throw new Error('TabStrip subcomponents must be used within a TabStrip');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

interface TabStripTabsProps {
  className?: string;
}

interface SortableTabProps {
  tab: TabDescriptor;
  editingTabId: string | null;
  onClose: (tabId: string) => void;
  onStartEditing: (tabId: string) => void;
  onStopEditing: () => void;
  onInlineRename: (tabId: string, newName: string) => void;
}

/**
 * A single sortable tab item.
 */
function SortableTab({
  tab,
  editingTabId,
  onClose,
  onStartEditing,
  onStopEditing,
  onInlineRename,
}: SortableTabProps) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: tab.id});

  const style: React.CSSProperties = {
    // Use Translate instead of Transform to avoid scale changes that squeeze the tab
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className="h-full flex-shrink-0"
      style={style}
      {...attributes}
      {...listeners}
    >
      <TabsTrigger
        value={tab.id}
        className="data-[state=inactive]:hover:bg-primary/5 flex h-full min-w-[100px] max-w-[200px] flex-shrink-0 cursor-grab items-center justify-between gap-2 overflow-hidden rounded-b-none py-0 pl-4 pr-2 font-normal data-[state=active]:shadow-none"
      >
        <div
          className="flex min-w-0 items-center"
          onDoubleClick={() => onStartEditing(tab.id)}
        >
          {editingTabId !== tab.id ? (
            <div className="truncate text-sm">{tab.name}</div>
          ) : (
            <EditableText
              value={tab.name}
              onChange={(newName) => onInlineRename(tab.id, newName)}
              className="h-6 min-w-0 flex-1 truncate text-sm shadow-none"
              isEditing
              onEditingChange={(isEditing) => {
                if (!isEditing) {
                  onStopEditing();
                }
              }}
            />
          )}
        </div>

        <span
          role="button"
          tabIndex={-1}
          aria-label="Close tab"
          className="hover:bg-primary/10 flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded p-1"
          onMouseDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
          }}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onClose(tab.id);
          }}
        >
          <XIcon className="h-4 w-4" />
        </span>
      </TabsTrigger>
    </div>
  );
}

/**
 * Renders the scrollable row of open tabs with drag-to-reorder support.
 */
function TabStripTabs({className}: TabStripTabsProps) {
  const {
    openTabs,
    editingTabId,
    scrollContainerRef,
    onReorder,
    handleStartEditing,
    handleStopEditing,
    handleInlineRename,
    handleClose,
  } = useTabStripContext();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts (allows clicks)
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = openTabs.findIndex((tab) => tab.id === active.id);
    const newIndex = openTabs.findIndex((tab) => tab.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(
        openTabs.map((t) => t.id),
        oldIndex,
        newIndex,
      );
      onReorder(newOrder);
    }
  };

  const tabIds = useMemo(() => openTabs.map((t) => t.id), [openTabs]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={DRAG_MODIFIERS}
      autoScroll={true}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
        <div
          ref={scrollContainerRef}
          className={cn(
            'flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden pr-1 [&::-webkit-scrollbar]:hidden',
            className,
          )}
        >
          {openTabs.map((tab) => (
            <SortableTab
              key={tab.id}
              tab={tab}
              editingTabId={editingTabId}
              onClose={handleClose}
              onStartEditing={handleStartEditing}
              onStopEditing={handleStopEditing}
              onInlineRename={handleInlineRename}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface TabStripSearchDropdownProps {
  className?: string;
  triggerClassName?: string;
  /** Whether to auto-focus the search input when dropdown opens. Defaults to true. */
  autoFocus?: boolean;
}

/**
 * Renders the dropdown with search for browsing tabs.
 * By default shows only closed tabs. When searching, shows all matching tabs.
 */
function TabStripSearchDropdown({
  className,
  triggerClassName,
  autoFocus = true,
}: TabStripSearchDropdownProps) {
  const {
    search,
    setSearch,
    closedTabs,
    filteredTabs,
    closedTabIds,
    onOpen,
    onSelect,
    onRenameRequest,
    onDelete,
  } = useTabStripContext();

  const [isOpen, setIsOpen] = useState(false);

  const isSearching = search.trim().length > 0;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearch('');
    }
  };

  const handleTabClick = (tabId: string) => {
    if (closedTabIds.has(tabId)) {
      onOpen?.(tabId);
    } else {
      onSelect?.(tabId);
    }
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Browse closed tabs"
          className={cn(
            'hover:bg-primary/10 ml-2 h-full flex-shrink-0',
            triggerClassName,
          )}
        >
          <ListCollapseIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={(event) => event.preventDefault()}
        className={cn('flex max-h-[400px] max-w-[240px] flex-col', className)}
      >
        <div className="flex flex-shrink-0 items-center gap-1 px-2">
          <SearchIcon className="text-muted-foreground" size={14} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'Tab') {
                event.preventDefault();
                const firstItem = event.currentTarget
                  .closest('[role="menu"]')
                  ?.querySelector<HTMLElement>(
                    '[role="menuitem"]:not([disabled])',
                  );
                firstItem?.focus();
              } else {
                event.stopPropagation();
              }
            }}
            onKeyUp={(event) => event.stopPropagation()}
            className="border-none text-xs shadow-none focus-visible:ring-0"
            placeholder="Search tabs..."
            aria-label="Search tabs"
            autoFocus={autoFocus}
          />
        </div>
        <DropdownMenuSeparator className="flex-shrink-0" />

        <div className="overflow-y-auto">
          {isSearching ? (
            <DropdownTabItems
              tabs={filteredTabs}
              emptyMessage="No matching tabs"
              onTabClick={handleTabClick}
              onRenameRequest={onRenameRequest}
              onDelete={onDelete}
            />
          ) : (
            <DropdownTabItems
              tabs={closedTabs}
              emptyMessage="No closed tabs"
              onTabClick={handleTabClick}
              onRenameRequest={onRenameRequest}
              onDelete={onDelete}
            />
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DropdownTabItemsProps {
  tabs: TabDescriptor[];
  emptyMessage?: string;
  onTabClick?: (tabId: string) => void;
  onRenameRequest?: (tabId: string) => void;
  onDelete?: (tabId: string) => void;
}

function DropdownTabItems({
  tabs,
  emptyMessage,
  onTabClick,
  onRenameRequest,
  onDelete,
}: DropdownTabItemsProps) {
  if (tabs.length === 0) {
    if (!emptyMessage) return null;
    return (
      <DropdownMenuLabel className="items-center justify-center text-xs">
        {emptyMessage}
      </DropdownMenuLabel>
    );
  }

  return (
    <>
      {tabs.map((tab) => (
        <DropdownMenuItem
          key={tab.id}
          onClick={() => onTabClick?.(tab.id)}
          className="flex h-7 cursor-pointer items-center justify-between truncate"
        >
          <span className="xs truncate pl-1">{tab.name}</span>
          <div className="flex items-center gap-1">
            {onRenameRequest && (
              <Button
                size="xs"
                variant="ghost"
                tabIndex={-1}
                aria-label={`Rename ${tab.name}`}
                className="text-muted-foreground h-3 w-3"
                onClick={(event) => {
                  event.stopPropagation();
                  onRenameRequest(tab.id);
                }}
              >
                <PencilIcon size={12} className="!size-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="xs"
                variant="ghost"
                tabIndex={-1}
                aria-label={`Delete ${tab.name}`}
                className="text-muted-foreground h-3 w-3"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(tab.id);
                }}
              >
                <TrashIcon size={12} className="!size-3" />
              </Button>
            )}
          </div>
        </DropdownMenuItem>
      ))}
    </>
  );
}

interface TabStripNewButtonProps {
  className?: string;
}

/**
 * Renders a button to create a new tab.
 */
function TabStripNewButton({className}: TabStripNewButtonProps) {
  const {onCreate} = useTabStripContext();

  if (!onCreate) {
    return null;
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Create new tab"
      onClick={() => onCreate()}
      className={cn('hover:bg-primary/10 h-full flex-shrink-0', className)}
    >
      <PlusIcon className="h-4 w-4" />
    </Button>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export interface TabStripProps {
  className?: string;
  children?: React.ReactNode;
  /** All available tabs. */
  tabs: TabDescriptor[];
  /** IDs of tabs that are currently open. */
  openTabIds: string[];
  /** ID of the currently selected tab. */
  selectedTabId?: string | null;
  /** Called when a tab is closed (hidden, can be reopened). */
  onClose?: (tabId: string) => void;
  /** Called when a closed tab is opened (shown). */
  onOpen?: (tabId: string) => void;
  /** Called when a tab is selected (clicked in dropdown). */
  onSelect?: (tabId: string) => void;
  /** Called when a new tab should be created. */
  onCreate?: () => void;
  /** Called when a tab is renamed inline. */
  onRename?: (tabId: string, newName: string) => void;
  /** Called when rename is requested via dropdown (for modal). */
  onRenameRequest?: (tabId: string) => void;
  /** Called when a tab is permanently deleted. */
  onDelete?: (tabId: string) => void;
  /** Called when tabs are reordered via drag-and-drop. Receives new order of open tab IDs. */
  onReorder?: (tabIds: string[]) => void;
}

/**
 * A composable tab strip component with search dropdown and tab management.
 *
 * @example
 * // Default layout
 * <TabStrip
 *   tabs={tabs}
 *   openTabIds={openTabIds}
 *   onClose={closeTab}
 *   onOpen={openTab}
 *   onCreate={createTab}
 * />
 *
 * @example
 * // Custom layout with subcomponents
 * <TabStrip tabs={tabs} openTabIds={openTabIds} onClose={closeTab}>
 *   <TabStrip.Tabs className="flex-1" />
 *   <TabStrip.SearchDropdown />
 *   <TabStrip.NewButton />
 * </TabStrip>
 */
function TabStripRoot({
  className,
  children,
  tabs,
  openTabIds,
  selectedTabId,
  onClose,
  onOpen,
  onSelect,
  onCreate,
  onRename,
  onRenameRequest,
  onDelete,
  onReorder,
}: TabStripProps) {
  const [search, setSearch] = useState('');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);

  const openTabIdsSet = useMemo(() => new Set(openTabIds), [openTabIds]);

  // Build openTabs in the order of openTabIds (for drag-to-reorder)
  const openTabs = useMemo(() => {
    const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
    return openTabIds
      .map((id) => tabsById.get(id))
      .filter((tab): tab is TabDescriptor => tab !== undefined);
  }, [tabs, openTabIds]);

  const closedTabs = useMemo(
    () => tabs.filter((tab) => !openTabIdsSet.has(tab.id)),
    [tabs, openTabIdsSet],
  );

  const closedTabIds = useMemo(
    () => new Set(closedTabs.map((tab) => tab.id)),
    [closedTabs],
  );

  const trimmedSearch = search.trim().toLowerCase();

  const filteredTabs = useMemo(
    () =>
      trimmedSearch
        ? tabs.filter((tab) => tab.name.toLowerCase().includes(trimmedSearch))
        : [],
    [tabs, trimmedSearch],
  );

  // Auto-scroll to selected tab
  useEffect(() => {
    if (!selectedTabId) return;
    if (prevSelectedIdRef.current === selectedTabId) return;
    prevSelectedIdRef.current = selectedTabId;

    const container = scrollContainerRef.current;
    if (!container) return;

    const isOpen = openTabs.some((tab) => tab.id === selectedTabId);
    if (!isOpen) return;

    const frameId = requestAnimationFrame(() => {
      const activeTab = container.querySelector<HTMLElement>(
        '[data-state="active"]',
      );
      if (!activeTab) return;

      activeTab.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [selectedTabId, openTabs]);

  const handleInlineRename = (tabId: string, newName: string) => {
    if (!onRename) return;
    const tab = tabs.find((t) => t.id === tabId);
    const trimmed = newName.trim();
    if (!trimmed || trimmed === tab?.name) {
      setEditingTabId(null);
      return;
    }
    onRename(tabId, trimmed);
    setEditingTabId(null);
  };

  const handleStartEditing = (tabId: string) => {
    if (!onRename) return;
    setEditingTabId(tabId);
  };

  const handleStopEditing = () => {
    setEditingTabId(null);
  };

  const handleClose = (tabId: string) => {
    // If closing the selected tab, select the one to the left (or right if leftmost)
    if (selectedTabId === tabId && openTabs.length > 1) {
      const closingIndex = openTabs.findIndex((t) => t.id === tabId);
      // If closing the leftmost, select the next; otherwise select the previous
      const newIndex = closingIndex === 0 ? 1 : closingIndex - 1;
      const newSelectedId = openTabs[newIndex]?.id;
      if (newSelectedId) {
        onSelect?.(newSelectedId);
      }
    }
    onClose?.(tabId);
  };

  const contextValue: TabStripContextValue = {
    openTabs,
    closedTabs,
    closedTabIds,
    filteredTabs,
    editingTabId,
    search,
    scrollContainerRef,
    selectedTabId,
    onOpen,
    onSelect,
    onCreate,
    onRename,
    onRenameRequest,
    onDelete,
    onReorder,
    setSearch,
    handleStartEditing,
    handleStopEditing,
    handleInlineRename,
    handleClose,
  };

  const handleValueChange = (value: string) => {
    onSelect?.(value);
  };

  return (
    <Tabs
      value={selectedTabId ?? undefined}
      onValueChange={handleValueChange}
      className="min-w-0"
    >
      <TabStripContext.Provider value={contextValue}>
        <TabsList
          className={cn(
            'flex min-w-0 justify-start gap-2 bg-transparent p-0 pt-1.5',
            className,
          )}
        >
          {children ?? (
            <>
              <TabStripSearchDropdown />
              <TabStripTabs />
              <TabStripNewButton />
            </>
          )}
        </TabsList>
      </TabStripContext.Provider>
    </Tabs>
  );
}

// Attach subcomponents
export const TabStrip = Object.assign(TabStripRoot, {
  Tabs: TabStripTabs,
  SearchDropdown: TabStripSearchDropdown,
  NewButton: TabStripNewButton,
});

export type {
  TabStripNewButtonProps,
  TabStripSearchDropdownProps,
  TabStripTabsProps,
};
