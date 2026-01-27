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
import {ScrollableRow} from './scrollable-row';
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
  openTabs?: string[];
  preventCloseLastTab: boolean;
  getLastOpenedAt: (tabId: string) => number | undefined;

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
      className="h-full shrink-0"
      style={style}
      data-tab-id={tab.id}
      {...attributes}
      {...listeners}
      tabIndex={-1}
    >
      <div
        data-state={editingTabId === tab.id ? 'editing' : undefined}
        className={cn(
          'data-[state=inactive]:hover:bg-primary/5',
          'group flex h-full min-w-[100px] max-w-[200px] flex-shrink-0 cursor-grab',
          'items-center gap-0.5 overflow-visible rounded-b-none',
          'py-0 pl-0 pr-0 font-normal data-[state=active]:shadow-none',
          tabClassName,
          editingTabId === tab.id && 'focus-visible:ring-0',
        )}
      >
        <div className="relative flex h-full min-w-0 flex-1 items-center">
          <TabsTrigger
            value={tab.id}
            tabIndex={editingTabId === tab.id ? -1 : undefined}
            data-editing={editingTabId === tab.id ? '' : undefined}
            className={cn(
              'flex h-full min-w-0 flex-1 items-center justify-start gap-1',
              'hover:bg-primary/10 overflow-hidden px-6 py-1 font-normal',
              'min-h-7',
              'data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-none',
              'focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-offset-0',
              editingTabId === tab.id && 'focus-visible:ring-0',
            )}
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
                autoFocus
                selectOnFocus
                allowTabFocusWhenNotEditing={false}
                onEditingChange={(isEditing) => {
                  if (!isEditing) {
                    onStopEditing();
                  }
                }}
              />
            )}
          </TabsTrigger>

          {menuContent && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Tab options"
                  className="hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:ring-primary absolute left-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded p-1 opacity-0 outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <EllipsisVerticalIcon className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {menuContent}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!hideCloseButton && (
            <button
              type="button"
              aria-label="Close tab"
              className="hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:ring-primary absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded p-1 opacity-0 outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-0 group-hover:opacity-100"
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
            </button>
          )}
        </div>
      </div>
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
        <ScrollableRow
          className="h-full min-w-0 flex-1"
          scrollRef={scrollContainerRef}
          scrollClassName={cn(
            'flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-visible',
            'py-1 pl-1 pr-1 scroll-pl-7 scroll-pr-7 [&::-webkit-scrollbar]:hidden',
            className,
          )}
          arrowVisibility="always"
          arrowClassName="w-7"
          arrowIconClassName="h-4 w-4 opacity-60"
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
        </ScrollableRow>
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
  /** Message shown when there are no tabs at all. */
  emptyMessage?: React.ReactNode;
  /** Message shown when searching and there are no matching tabs. */
  searchEmptyMessage?: React.ReactNode;
  /** Label for the closed tabs group. */
  closedTabsLabel?: React.ReactNode;
  /** Sorting mode for search dropdown items. */
  sortSearchItems?: 'none' | 'recent';
  /** Optional accessor for tab recency timestamps. */
  getTabLastOpenedAt?: (tab: TabDescriptor) => number | undefined;
}

/**
 * Renders the dropdown with search for browsing tabs.
 * Shows open tabs first and closed tabs second (dimmed). When searching, shows all matching tabs.
 */
function TabStripSearchDropdown({
  className,
  triggerClassName,
  autoFocus = true,
  tooltip,
  triggerIcon,
  emptyMessage = 'No tabs',
  searchEmptyMessage = 'No matching tabs',
  closedTabsLabel = 'Recently closed',
  sortSearchItems = 'recent',
  getTabLastOpenedAt,
}: TabStripSearchDropdownProps) {
  const {
    openTabItems,
    search,
    setSearch,
    closedTabs,
    filteredTabs,
    closedTabIds,
    openTabs,
    preventCloseLastTab,
    onOpenTabsChange,
    onSelect,
    renderSearchItemActions,
    getLastOpenedAt,
    handleClose,
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
      onOpenTabsChange?.([...(openTabs ?? []), tabId]);
      onSelect?.(tabId);
    } else {
      // Already open: just select it
      onSelect?.(tabId);
    }
    setIsOpen(false);
  };

  const sortByRecency = (tabsToSort: TabDescriptor[]) => {
    if (sortSearchItems !== 'recent') {
      return tabsToSort;
    }

    const withIndex = tabsToSort.map((tab, index) => ({
      tab,
      index,
      ts: getTabLastOpenedAt?.(tab) ?? getLastOpenedAt(tab.id),
    }));

    return withIndex
      .slice()
      .sort((a, b) => {
        const aTs = a.ts ?? -1;
        const bTs = b.ts ?? -1;
        if (aTs === bTs) {
          return a.index - b.index;
        }
        return bTs - aTs;
      })
      .map((item) => item.tab);
  };

  const openTabsList = sortByRecency(openTabItems);
  const closedTabsList = sortByRecency(closedTabs);
  const hasAnyTabs = openTabsList.length + closedTabsList.length > 0;

  const filteredOpenTabs = sortByRecency(
    filteredTabs.filter((tab) => !closedTabIds.has(tab.id)),
  );
  const filteredClosedTabs = sortByRecency(
    filteredTabs.filter((tab) => closedTabIds.has(tab.id)),
  );

  const renderOpenTabActions = (tab: TabDescriptor) => {
    const disableClose = preventCloseLastTab && (openTabsList.length ?? 0) <= 1;
    return (
      <>
        {renderSearchItemActions?.(tab)}
        <TabStripSearchItemAction
          icon={<XIcon className="h-3 w-3" />}
          aria-label={`Close ${tab.name}`}
          onClick={disableClose ? undefined : () => handleClose(tab.id)}
          className={cn(disableClose && 'pointer-events-none opacity-40')}
        />
      </>
    );
  };

  const triggerButton = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        aria-label="Browse tabs"
        className={cn('hover:bg-primary/10 h-full shrink-0', triggerClassName)}
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
        className={cn(
          'flex max-h-[400px] max-w-[240px] flex-col overflow-x-hidden',
          className,
        )}
      >
        <div className="flex shrink-0 items-center gap-1 px-2">
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
        <DropdownMenuSeparator className="shrink-0" />

        <div className="overflow-y-auto overflow-x-hidden">
          {isSearching ? (
            filteredTabs.length === 0 ? (
              <DropdownTabItems
                tabs={filteredTabs}
                emptyMessage={searchEmptyMessage}
                onTabClick={handleTabClick}
                renderActions={renderSearchItemActions}
              />
            ) : (
              <>
                <DropdownTabItems
                  tabs={filteredOpenTabs}
                  onTabClick={handleTabClick}
                  renderActions={renderOpenTabActions}
                />
                {filteredClosedTabs.length > 0 && (
                  <>
                    {filteredOpenTabs.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-muted-foreground py-1 text-xs font-medium">
                      {closedTabsLabel}
                    </DropdownMenuLabel>
                    <DropdownTabItems
                      tabs={filteredClosedTabs}
                      onTabClick={handleTabClick}
                      renderActions={renderSearchItemActions}
                      getItemClassName={() => 'text-muted-foreground'}
                    />
                  </>
                )}
              </>
            )
          ) : (
            <>
              {hasAnyTabs ? (
                <>
                  <DropdownTabItems
                    tabs={openTabsList}
                    onTabClick={handleTabClick}
                    renderActions={renderOpenTabActions}
                  />
                  {closedTabsList.length > 0 && (
                    <>
                      {openTabsList.length > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="text-muted-foreground py-1 text-xs font-medium">
                        {closedTabsLabel}
                      </DropdownMenuLabel>
                      <DropdownTabItems
                        tabs={closedTabsList}
                        onTabClick={handleTabClick}
                        renderActions={renderSearchItemActions}
                        getItemClassName={() => 'text-muted-foreground'}
                      />
                    </>
                  )}
                </>
              ) : (
                <DropdownTabItems
                  tabs={[]}
                  emptyMessage={emptyMessage}
                  onTabClick={handleTabClick}
                  renderActions={renderSearchItemActions}
                />
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DropdownTabItemsProps {
  tabs: TabDescriptor[];
  emptyMessage?: React.ReactNode;
  onTabClick?: (tabId: string) => void;
  renderActions?: (tab: TabDescriptor) => React.ReactNode;
  getItemClassName?: (tab: TabDescriptor) => string | undefined;
}

function DropdownTabItems({
  tabs,
  emptyMessage,
  onTabClick,
  renderActions,
  getItemClassName,
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
          className={cn(
            'flex h-7 cursor-pointer items-center justify-between truncate',
            getItemClassName?.(tab),
          )}
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
      className={cn('hover:bg-primary/10 h-full shrink-0', className)}
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
  openTabs?: string[];
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
  const lastOpenedAtRef = useRef<Map<string, number>>(new Map());

  const openTabsSet = useMemo(() => new Set(openTabs), [openTabs]);

  // Build openTabItems in the order of openTabs (for drag-to-reorder)
  const openTabItems = useMemo(() => {
    const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
    return (openTabs ?? [])
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

  useEffect(() => {
    if (!selectedTabId) return;
    lastOpenedAtRef.current.set(selectedTabId, Date.now());
  }, [selectedTabId]);

  useEffect(() => {
    const ids = new Set(tabs.map((tab) => tab.id));
    const next = new Map<string, number>();
    for (const [id, ts] of lastOpenedAtRef.current.entries()) {
      if (ids.has(id)) {
        next.set(id, ts);
      }
    }
    lastOpenedAtRef.current = next;
  }, [tabs]);

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
    const newTabIds = (openTabs ?? []).filter(
      (id) => !prevOpenTabIdsRef.current.has(id),
    );

    // Update ref for next comparison
    prevOpenTabIdsRef.current = new Set(openTabs);

    if (newTabIds.length > 0) {
      const now = Date.now();
      for (const id of newTabIds) {
        lastOpenedAtRef.current.set(id, now);
      }
    }

    // Skip scroll on initial render (when ref was empty, all tabs appear "new")
    if (newTabIds.length === (openTabs?.length ?? 0)) return;

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
    getLastOpenedAt: (tabId) => lastOpenedAtRef.current.get(tabId),
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
      activationMode="manual"
      className={cn('bg-muted w-full min-w-0', className)}
    >
      <TabStripContext.Provider value={contextValue}>
        <TabsList
          className={cn(
            'flex h-9 w-full min-w-0 items-center justify-start gap-2 overflow-visible bg-transparent p-0',
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
