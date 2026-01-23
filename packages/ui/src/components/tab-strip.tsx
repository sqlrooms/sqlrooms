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
  EllipsisVerticalIcon,
  ListCollapseIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

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
  openTabItems: TabDescriptor[];
  closedTabs: TabDescriptor[];
  closedTabIds: Set<string>;
  filteredTabs: TabDescriptor[];
  editingTabId: string | null;
  search: string;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  selectedTabId?: string | null;
  openTabs: string[];
  preventCloseLastTab: boolean;

  // Callbacks
  onOpenTabsChange?: (tabIds: string[]) => void;
  onSelect?: (tabId: string) => void;
  onCreate?: () => void;
  onRename?: (tabId: string, newName: string) => void;
  renderTabMenu?: (tab: TabDescriptor) => React.ReactNode;
  renderSearchItemActions?: (tab: TabDescriptor) => React.ReactNode;
  renderTabLabel?: (tab: TabDescriptor) => React.ReactNode;

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
  /** Custom className for individual tab triggers. */
  tabClassName?: string;
}

interface SortableTabProps {
  tab: TabDescriptor;
  tabClassName?: string;
  editingTabId: string | null;
  hideCloseButton?: boolean;
  onClose: (tabId: string) => void;
  onStartEditing: (tabId: string) => void;
  onStopEditing: () => void;
  onInlineRename: (tabId: string, newName: string) => void;
  renderTabMenu?: (tab: TabDescriptor) => React.ReactNode;
  renderTabLabel?: (tab: TabDescriptor) => React.ReactNode;
}

/**
 * A single sortable tab item.
 */
function SortableTab({
  tab,
  tabClassName,
  editingTabId,
  hideCloseButton,
  onClose,
  onStartEditing,
  onStopEditing,
  onInlineRename,
  renderTabMenu,
  renderTabLabel,
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

  const menuContent = renderTabMenu?.(tab);

  return (
    <div
      ref={setNodeRef}
      className="h-full flex-shrink-0"
      style={style}
      data-tab-id={tab.id}
      {...attributes}
      {...listeners}
    >
      <TabsTrigger
        value={tab.id}
        className={cn(
          'data-[state=inactive]:hover:bg-primary/5',
          'group flex h-full min-w-[100px] max-w-[200px] flex-shrink-0 cursor-grab',
          'items-center justify-between gap-1 overflow-hidden rounded-b-none',
          'py-0 pl-4 pr-1 font-normal data-[state=active]:shadow-none',
          tabClassName,
        )}
      >
        <div
          className="flex min-w-0 items-center"
          onDoubleClick={() => onStartEditing(tab.id)}
        >
          {editingTabId !== tab.id ? (
            <div className="truncate text-sm">
              {renderTabLabel ? renderTabLabel(tab) : tab.name}
            </div>
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

        <div className="flex flex-shrink-0 items-center">
          {menuContent && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Tab options"
                  className="hover:bg-primary/10 flex h-5 w-5 cursor-pointer items-center justify-center rounded p-1 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <EllipsisVerticalIcon className="h-3 w-3" />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {menuContent}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!hideCloseButton && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Close tab"
              className="hover:bg-primary/10 flex h-5 w-5 cursor-pointer items-center justify-center rounded p-1"
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
          )}
        </div>
      </TabsTrigger>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tab Menu Components (for use with renderTabMenu)
// -----------------------------------------------------------------------------

interface TabStripMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  className?: string;
  disabled?: boolean;
}

/**
 * A menu item for the tab's dropdown menu.
 */
function TabStripMenuItem({
  children,
  onClick,
  variant = 'default',
  className,
  disabled,
}: TabStripMenuItemProps) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        variant === 'destructive' && 'text-destructive focus:text-destructive',
        className,
      )}
    >
      {children}
    </DropdownMenuItem>
  );
}

interface TabStripMenuSeparatorProps {
  className?: string;
}

/**
 * A separator for the tab's dropdown menu.
 */
function TabStripMenuSeparator({className}: TabStripMenuSeparatorProps) {
  return <DropdownMenuSeparator className={className} />;
}

interface TabStripSearchItemActionProps {
  icon: React.ReactNode;
  onClick?: () => void;
  'aria-label': string;
  className?: string;
}

/**
 * An action button for search dropdown items.
 */
function TabStripSearchItemAction({
  icon,
  onClick,
  'aria-label': ariaLabel,
  className,
}: TabStripSearchItemActionProps) {
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      className={cn(
        'text-muted-foreground hover:text-foreground flex h-4 w-4 cursor-pointer items-center justify-center rounded',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {icon}
    </span>
  );
}

/**
 * Renders the scrollable row of open tabs with drag-to-reorder support.
 */
function TabStripTabs({className, tabClassName}: TabStripTabsProps) {
  const {
    openTabItems,
    editingTabId,
    scrollContainerRef,
    onOpenTabsChange,
    renderTabMenu,
    renderTabLabel,
    preventCloseLastTab,
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
    if (!over || active.id === over.id || !onOpenTabsChange) return;

    const oldIndex = openTabItems.findIndex((tab) => tab.id === active.id);
    const newIndex = openTabItems.findIndex((tab) => tab.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(
        openTabItems.map((t) => t.id),
        oldIndex,
        newIndex,
      );
      onOpenTabsChange(newOrder);
    }
  };

  const tabIds = useMemo(() => openTabItems.map((t) => t.id), [openTabItems]);

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
          {openTabItems.map((tab) => (
            <SortableTab
              key={tab.id}
              tab={tab}
              tabClassName={tabClassName}
              editingTabId={editingTabId}
              hideCloseButton={preventCloseLastTab && openTabItems.length === 1}
              onClose={handleClose}
              onStartEditing={handleStartEditing}
              onStopEditing={handleStopEditing}
              onInlineRename={handleInlineRename}
              renderTabMenu={renderTabMenu}
              renderTabLabel={renderTabLabel}
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
  /** Optional tooltip content for the trigger button. */
  tooltip?: React.ReactNode;
  /** Optional custom icon for the trigger button. */
  triggerIcon?: React.ReactNode;
}

/**
 * Renders the dropdown with search for browsing tabs.
 * By default shows only closed tabs. When searching, shows all matching tabs.
 */
function TabStripSearchDropdown({
  className,
  triggerClassName,
  autoFocus = true,
  tooltip,
  triggerIcon,
}: TabStripSearchDropdownProps) {
  const {
    search,
    setSearch,
    closedTabs,
    filteredTabs,
    closedTabIds,
    openTabs,
    onOpenTabsChange,
    onSelect,
    renderSearchItemActions,
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
      // Opening a closed tab: add to openTabs and select it
      onOpenTabsChange?.([...openTabs, tabId]);
      onSelect?.(tabId);
    } else {
      // Already open: just select it
      onSelect?.(tabId);
    }
    setIsOpen(false);
  };

  const triggerButton = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        aria-label="Browse tabs"
        className={cn(
          'hover:bg-primary/10 h-full flex-shrink-0',
          triggerClassName,
        )}
      >
        {triggerIcon ?? <ListCollapseIcon className="h-4 w-4" />}
      </Button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      {tooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        triggerButton
      )}

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
            placeholder="Search..."
            aria-label="Search"
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
              renderActions={renderSearchItemActions}
            />
          ) : (
            <DropdownTabItems
              tabs={closedTabs}
              emptyMessage="No closed tabs"
              onTabClick={handleTabClick}
              renderActions={renderSearchItemActions}
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
  renderActions?: (tab: TabDescriptor) => React.ReactNode;
}

function DropdownTabItems({
  tabs,
  emptyMessage,
  onTabClick,
  renderActions,
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
          {renderActions && (
            <div className="flex items-center gap-2">{renderActions(tab)}</div>
          )}
        </DropdownMenuItem>
      ))}
    </>
  );
}

interface TabStripNewButtonProps {
  className?: string;
  /** Optional tooltip content for the button. */
  tooltip?: React.ReactNode;
}

/**
 * Renders a button to create a new tab.
 */
function TabStripNewButton({className, tooltip}: TabStripNewButtonProps) {
  const {onCreate} = useTabStripContext();

  if (!onCreate) {
    return null;
  }

  const button = (
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

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export interface TabStripProps {
  className?: string;
  tabsListClassName?: string;
  children?: React.ReactNode;
  /** All available tabs. */
  tabs: TabDescriptor[];
  /** IDs of tabs that are currently open. */
  openTabs: string[];
  /** ID of the currently selected tab. */
  selectedTabId?: string | null;
  /** If true, hides the close button when only one tab remains open. */
  preventCloseLastTab?: boolean;
  /** Called when a tab is closed (hidden, can be reopened). */
  onClose?: (tabId: string) => void;
  /** Called when the list of open tabs changes (open from dropdown or reorder). */
  onOpenTabsChange?: (tabIds: string[]) => void;
  /** Called when a tab is selected. */
  onSelect?: (tabId: string) => void;
  /** Called when a new tab should be created. */
  onCreate?: () => void;
  /** Called when a tab is renamed inline. */
  onRename?: (tabId: string, newName: string) => void;
  /** Render function for the tab's dropdown menu. Use TabStrip.MenuItem and TabStrip.MenuSeparator. */
  renderTabMenu?: (tab: TabDescriptor) => React.ReactNode;
  /** Render function for search dropdown item actions. Use TabStrip.SearchItemAction. */
  renderSearchItemActions?: (tab: TabDescriptor) => React.ReactNode;
  /** Render function for custom tab content. Receives the tab and returns the content to display. */
  renderTabLabel?: (tab: TabDescriptor) => React.ReactNode;
}

/**
 * A composable tab strip component with search dropdown and tab management.
 *
 * @example
 * // Default layout
 * <TabStrip
 *   tabs={tabs}
 *   openTabs={openTabs}
 *   onClose={closeTab}
 *   onOpen={openTab}
 *   onCreate={createTab}
 * />
 *
 * @example
 * // Custom layout with subcomponents
 * <TabStrip tabs={tabs} openTabs={openTabs} onClose={closeTab}>
 *   <TabStrip.Tabs className="flex-1" />
 *   <TabStrip.SearchDropdown />
 *   <TabStrip.NewButton />
 * </TabStrip>
 */
function TabStripRoot({
  className,
  tabsListClassName,
  children,
  tabs,
  openTabs,
  selectedTabId,
  preventCloseLastTab = false,
  onClose,
  onOpenTabsChange,
  onSelect,
  onCreate,
  onRename,
  renderTabMenu,
  renderSearchItemActions,
  renderTabLabel,
}: TabStripProps) {
  const [search, setSearch] = useState('');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null!);
  const prevSelectedIdRef = useRef<string | null>(null);
  const prevOpenTabIdsRef = useRef<Set<string>>(new Set());

  const openTabsSet = useMemo(() => new Set(openTabs), [openTabs]);

  // Build openTabItems in the order of openTabs (for drag-to-reorder)
  const openTabItems = useMemo(() => {
    const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
    return openTabs
      .map((id) => tabsById.get(id))
      .filter((tab): tab is TabDescriptor => tab !== undefined);
  }, [tabs, openTabs]);

  const closedTabs = useMemo(
    () => tabs.filter((tab) => !openTabsSet.has(tab.id)),
    [tabs, openTabsSet],
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
  useLayoutEffect(() => {
    if (!selectedTabId) return;
    if (prevSelectedIdRef.current === selectedTabId) return;
    prevSelectedIdRef.current = selectedTabId;

    const container = scrollContainerRef.current;
    if (!container) return;

    const isOpen = openTabItems.some((tab) => tab.id === selectedTabId);
    if (!isOpen) return;

    // Use queueMicrotask to defer scroll until after Radix UI updates the DOM
    queueMicrotask(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTabId]);

  // Auto-scroll to newly added tab
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Find newly added tabs (in openTabs but not in prevOpenTabIdsRef)
    const newTabIds = openTabs.filter(
      (id) => !prevOpenTabIdsRef.current.has(id),
    );

    // Update ref for next comparison
    prevOpenTabIdsRef.current = new Set(openTabs);

    // If there are new tabs, scroll to the last one added
    if (newTabIds.length === 0) return;
    const newTabId = newTabIds[newTabIds.length - 1];

    queueMicrotask(() => {
      const newTabElement = container.querySelector<HTMLElement>(
        `[data-tab-id="${newTabId}"]`,
      );
      if (!newTabElement) return;

      newTabElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    });
  }, [openTabs]);

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
    if (selectedTabId === tabId && openTabItems.length > 1) {
      const closingIndex = openTabItems.findIndex((t) => t.id === tabId);
      // If closing the leftmost, select the next; otherwise select the previous
      const newIndex = closingIndex === 0 ? 1 : closingIndex - 1;
      const newSelectedId = openTabItems[newIndex]?.id;
      if (newSelectedId) {
        onSelect?.(newSelectedId);
      }
    }
    onClose?.(tabId);
  };

  const contextValue: TabStripContextValue = {
    openTabItems,
    closedTabs,
    closedTabIds,
    filteredTabs,
    editingTabId,
    search,
    scrollContainerRef,
    selectedTabId,
    openTabs,
    preventCloseLastTab,
    onOpenTabsChange,
    onSelect,
    onCreate,
    onRename,
    renderTabMenu,
    renderSearchItemActions,
    renderTabLabel,
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
      className={cn('bg-muted w-full min-w-0', className)}
    >
      <TabStripContext.Provider value={contextValue}>
        <TabsList
          className={cn(
            'flex w-full min-w-0 justify-start gap-2 bg-transparent p-0',
            tabsListClassName,
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
  MenuItem: TabStripMenuItem,
  MenuSeparator: TabStripMenuSeparator,
  SearchItemAction: TabStripSearchItemAction,
});

export type {
  TabStripMenuItemProps,
  TabStripMenuSeparatorProps,
  TabStripNewButtonProps,
  TabStripSearchDropdownProps,
  TabStripSearchItemActionProps,
  TabStripTabsProps,
};
