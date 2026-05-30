import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDndMonitor,
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
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

const DRAG_MODIFIERS = [restrictToHorizontalAxis, restrictToParentElement];

import {cn} from '../lib/utils';
import {Button, ButtonProps} from './button';
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

export type TabStripDndMode = 'internal' | 'shared';

/**
 * Extra payload attached to tab drags. `TabStrip` always preserves `tabId` and
 * `tabStripId`; callers may intentionally override `kind` for cross-component
 * drags such as artifact tabs.
 */
export type TabStripDragData = Record<string, unknown>;

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
  closeable: boolean;
  getLastOpenedAt: (tabId: string) => number | undefined;
  dndMode: TabStripDndMode;
  dndScopeId: string;
  getTabDragData?: (tab: TabDescriptor) => TabStripDragData | undefined;
  fontSize?: React.CSSProperties['fontSize'];

  // Callbacks
  onOpenTabsChange?: (tabIds: string[]) => void;
  onSelect?: (tabId: string) => void;
  onActivate?: (tabId: string) => void;
  onCreate?: () => void;
  onRename?: (tabId: string, newName: string) => void;
  renderTabMenu?: (tab: TabDescriptor) => React.ReactNode;
  renderSearchItemActions?: (tab: TabDescriptor) => React.ReactNode;
  renderSearchItemLabel?: (tab: TabDescriptor) => React.ReactNode;
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

function useOptionalTabStripContext() {
  return useContext(TabStripContext);
}

function getFontSizeStyle(fontSize?: React.CSSProperties['fontSize']) {
  return fontSize === undefined
    ? undefined
    : ({fontSize} as React.CSSProperties);
}

function mergeFontSizeStyle(
  fontSize: React.CSSProperties['fontSize'] | undefined,
  style: React.CSSProperties | undefined,
) {
  if (fontSize === undefined) return style;
  if (style === undefined) return {fontSize};
  return {...style, fontSize: style?.fontSize ?? fontSize};
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
  sortableId: string;
  tabClassName?: string;
  editingTabId: string | null;
  closeable?: boolean;
  onClose: (tabId: string) => void;
  onActivate: (tabId: string) => void;
  onStartEditing: (tabId: string) => void;
  onStopEditing: () => void;
  onInlineRename: (tabId: string, newName: string) => void;
  renderTabMenu?: (tab: TabDescriptor) => React.ReactNode;
  renderTabLabel?: (tab: TabDescriptor) => React.ReactNode;
  dndScopeId: string;
  getTabDragData?: (tab: TabDescriptor) => TabStripDragData | undefined;
  fontSize?: React.CSSProperties['fontSize'];
}

const DEFAULT_TAB_DRAG_KIND = 'sqlrooms.tab';

const TAB_STRIP_BUTTON_CLASSNAMES = [
  'flex h-full min-w-0 min-h-7 items-center',
  'hover:bg-primary/10 overflow-hidden px-6 py-1 font-normal',
  'focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-inset',
];

/**
 * A single sortable tab item.
 */
function SortableTab({
  tab,
  sortableId,
  tabClassName,
  editingTabId,
  closeable = true,
  onClose,
  onActivate,
  onStartEditing,
  onStopEditing,
  onInlineRename,
  renderTabMenu,
  renderTabLabel,
  dndScopeId,
  getTabDragData,
  fontSize,
}: SortableTabProps) {
  const tabDragData = getTabDragData?.(tab);
  const isEditing = editingTabId === tab.id;
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({
      id: sortableId,
      disabled: isEditing,
      data: {
        kind: DEFAULT_TAB_DRAG_KIND,
        ...tabDragData,
        tabId: tab.id,
        tabStripId: dndScopeId,
      },
    });

  const style: React.CSSProperties = {
    // Use Translate instead of Transform to avoid scale changes that squeeze the tab
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const menuContent = renderTabMenu?.(tab);
  const fontSizeStyle = getFontSizeStyle(fontSize);

  return (
    <div
      ref={setNodeRef}
      className="h-full shrink-0"
      style={style}
      data-tab-id={tab.id}
      {...(isEditing ? {} : attributes)}
      {...(isEditing ? {} : listeners)}
      tabIndex={-1}
    >
      <div
        data-state={isEditing ? 'editing' : undefined}
        className={cn(
          'data-[state=inactive]:hover:bg-primary/5',
          'group/tab flex h-full max-w-[200px] min-w-[100px] shrink-0 cursor-grab',
          'items-center justify-between gap-1 overflow-hidden rounded-b-none',
          'py-0 pr-1 font-normal data-[state=active]:shadow-none',
          tabClassName,
          isEditing && 'focus-visible:ring-0',
        )}
      >
        <div className="relative flex h-full min-w-0 flex-1 items-center">
          <TabsTrigger
            value={tab.id}
            tabIndex={isEditing ? -1 : undefined}
            data-editing={isEditing ? '' : undefined}
            className={cn(
              ...TAB_STRIP_BUTTON_CLASSNAMES,
              'flex-1 justify-start gap-1',
              'data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-none',
              isEditing && 'focus-visible:ring-0',
            )}
            style={fontSizeStyle}
            onClick={() => onActivate(tab.id)}
            onDoubleClick={() => onStartEditing(tab.id)}
          >
            {!isEditing ? (
              <div className="truncate">
                {renderTabLabel ? renderTabLabel(tab) : tab.name}
              </div>
            ) : (
              <EditableText
                value={tab.name}
                onChange={(newName) => onInlineRename(tab.id, newName)}
                className="h-6 min-w-0 flex-1 truncate shadow-none"
                style={fontSizeStyle}
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

          <div className="flex shrink-0 items-center">
            {menuContent && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Tab options"
                    className="hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:ring-ring absolute top-1/2 left-1 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded p-1 opacity-0 outline-hidden group-hover/tab:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-0 data-[state=open]:opacity-100"
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
                <DropdownMenuContent align="start" style={fontSizeStyle}>
                  {menuContent}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {closeable && (
              <button
                type="button"
                aria-label="Close tab"
                className="hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:ring-ring absolute top-1/2 right-1 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded p-1 opacity-0 outline-hidden group-hover/tab:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-0"
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
  const {fontSize} = useTabStripContext();

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
      style={getFontSizeStyle(fontSize)}
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
    dndMode,
    dndScopeId,
    getTabDragData,
    renderTabMenu,
    renderTabLabel,
    preventCloseLastTab,
    closeable,
    fontSize,
    handleStartEditing,
    handleStopEditing,
    handleInlineRename,
    handleClose,
    onActivate,
  } = useTabStripContext();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts (allows clicks)
      },
    }),
  );
  const [activeDraggedTabId, setActiveDraggedTabId] = useState<string | null>(
    null,
  );
  const [hideSharedDragOverlay, setHideSharedDragOverlay] = useState(false);

  const isDragInsideTabStrip = (
    event: DragMoveEvent | DragOverEvent | DragStartEvent,
  ) => {
    const rect =
      event.active.rect.current.translated ?? event.active.rect.current.initial;
    const tabStripRect = scrollContainerRef.current?.getBoundingClientRect();
    if (!rect || !tabStripRect) return false;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    return (
      centerX >= tabStripRect.left &&
      centerX <= tabStripRect.right &&
      centerY >= tabStripRect.top &&
      centerY <= tabStripRect.bottom
    );
  };

  const shouldHideSharedDragOverlay = (
    event: DragMoveEvent | DragOverEvent | DragStartEvent,
  ) => {
    if (isDragInsideTabStrip(event)) {
      return true;
    }
    if ('over' in event) {
      return event.over?.data.current?.tabStripId === dndScopeId;
    }
    return false;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (!over || active.id === over.id || !onOpenTabsChange) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    const activeTabId =
      typeof activeData?.tabId === 'string'
        ? activeData.tabId
        : String(active.id);
    const overTabId =
      typeof overData?.tabId === 'string' ? overData.tabId : String(over.id);

    if (
      dndMode === 'shared' &&
      (activeData?.tabStripId !== dndScopeId ||
        overData?.tabStripId !== dndScopeId)
    ) {
      return;
    }

    const oldIndex = openTabItems.findIndex((tab) => tab.id === activeTabId);
    const newIndex = openTabItems.findIndex((tab) => tab.id === overTabId);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(
        openTabItems.map((t) => t.id),
        oldIndex,
        newIndex,
      );
      onOpenTabsChange(newOrder);
    }
  };

  const getSortableId = (tabId: string) =>
    dndMode === 'shared' ? `${dndScopeId}:${tabId}` : tabId;

  const tabIds = useMemo(
    () => openTabItems.map((t) => getSortableId(t.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openTabItems, dndMode, dndScopeId],
  );

  const content = (
    <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
      <ScrollableRow
        className="h-full min-w-0 shrink overflow-hidden"
        scrollRef={scrollContainerRef}
        scrollClassName={cn(
          'flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-visible',
          'pl-1 pr-1 scroll-pl-7 scroll-pr-7 [&::-webkit-scrollbar]:hidden',
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
            sortableId={getSortableId(tab.id)}
            tabClassName={tabClassName}
            editingTabId={editingTabId}
            closeable={
              closeable && !(preventCloseLastTab && openTabItems.length === 1)
            }
            onClose={handleClose}
            onActivate={onActivate ?? (() => undefined)}
            onStartEditing={handleStartEditing}
            onStopEditing={handleStopEditing}
            onInlineRename={handleInlineRename}
            renderTabMenu={renderTabMenu}
            renderTabLabel={renderTabLabel}
            dndScopeId={dndScopeId}
            getTabDragData={getTabDragData}
            fontSize={fontSize}
          />
        ))}
      </ScrollableRow>
    </SortableContext>
  );

  if (dndMode === 'shared') {
    const activeDraggedTab = activeDraggedTabId
      ? openTabItems.find((tab) => tab.id === activeDraggedTabId)
      : undefined;

    return (
      <>
        <SharedTabStripDndMonitor
          dndScopeId={dndScopeId}
          handleDragEnd={handleDragEnd}
          setActiveDraggedTabId={setActiveDraggedTabId}
          setHideSharedDragOverlay={setHideSharedDragOverlay}
          shouldHideSharedDragOverlay={shouldHideSharedDragOverlay}
        />
        {content}
        <DragOverlay dropAnimation={null}>
          {activeDraggedTab && !hideSharedDragOverlay ? (
            <TabDragOverlay
              tab={activeDraggedTab}
              renderTabLabel={renderTabLabel}
              fontSize={fontSize}
            />
          ) : null}
        </DragOverlay>
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={DRAG_MODIFIERS}
      autoScroll={true}
      onDragEnd={handleDragEnd}
    >
      {content}
    </DndContext>
  );
}

function SharedTabStripDndMonitor({
  dndScopeId,
  handleDragEnd,
  setActiveDraggedTabId,
  setHideSharedDragOverlay,
  shouldHideSharedDragOverlay,
}: {
  dndScopeId: string;
  handleDragEnd: (event: DragEndEvent) => void;
  setActiveDraggedTabId: React.Dispatch<React.SetStateAction<string | null>>;
  setHideSharedDragOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  shouldHideSharedDragOverlay: (
    event: DragMoveEvent | DragOverEvent | DragStartEvent,
  ) => boolean;
}) {
  const isOwnTabDrag = (
    event: DragStartEvent | DragMoveEvent | DragOverEvent | DragEndEvent,
  ) => event.active.data.current?.tabStripId === dndScopeId;

  useDndMonitor({
    onDragStart: (event) => {
      const activeData = event.active.data.current;
      if (!isOwnTabDrag(event)) {
        return;
      }
      setActiveDraggedTabId(
        typeof activeData?.tabId === 'string' ? activeData.tabId : null,
      );
      setHideSharedDragOverlay(true);
    },
    onDragMove: (event) => {
      if (!isOwnTabDrag(event)) return;
      setHideSharedDragOverlay(shouldHideSharedDragOverlay(event));
    },
    onDragOver: (event) => {
      if (!isOwnTabDrag(event)) return;
      setHideSharedDragOverlay(shouldHideSharedDragOverlay(event));
    },
    onDragEnd: (event) => {
      if (!isOwnTabDrag(event)) return;
      handleDragEnd(event);
      setActiveDraggedTabId(null);
      setHideSharedDragOverlay(false);
    },
    onDragCancel: () => {
      setActiveDraggedTabId(null);
      setHideSharedDragOverlay(false);
    },
  });

  return null;
}

function TabDragOverlay({
  tab,
  renderTabLabel,
  fontSize,
}: {
  tab: TabDescriptor;
  renderTabLabel?: (tab: TabDescriptor) => React.ReactNode;
  fontSize?: React.CSSProperties['fontSize'];
}) {
  return (
    <div
      className={cn(
        'bg-primary/15 text-foreground border-primary/50 flex h-7 max-w-[200px] min-w-[100px]',
        'cursor-grabbing items-center justify-center gap-1 overflow-hidden rounded-md border px-6 py-1',
        'text-sm shadow-lg',
      )}
      style={getFontSizeStyle(fontSize)}
    >
      <div className="truncate text-center">
        {renderTabLabel ? renderTabLabel(tab) : tab.name}
      </div>
    </div>
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
    renderSearchItemLabel,
    getLastOpenedAt,
    handleClose,
    fontSize,
  } = useTabStripContext();
  const fontSizeStyle = getFontSizeStyle(fontSize);

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
        size="icon"
        className={cn(...TAB_STRIP_BUTTON_CLASSNAMES, triggerClassName)}
        style={fontSizeStyle}
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
        style={fontSizeStyle}
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
            style={fontSizeStyle}
            placeholder="Search..."
            aria-label="Search"
            autoFocus={autoFocus}
          />
        </div>
        <DropdownMenuSeparator className="shrink-0" />

        <div className="overflow-x-hidden overflow-y-auto">
          {isSearching ? (
            filteredTabs.length === 0 ? (
              <DropdownTabItems
                tabs={filteredTabs}
                emptyMessage={searchEmptyMessage}
                onTabClick={handleTabClick}
                renderLabel={renderSearchItemLabel}
                renderActions={renderSearchItemActions}
              />
            ) : (
              <>
                <DropdownTabItems
                  tabs={filteredOpenTabs}
                  onTabClick={handleTabClick}
                  renderLabel={renderSearchItemLabel}
                  renderActions={renderOpenTabActions}
                />
                {filteredClosedTabs.length > 0 && (
                  <>
                    {filteredOpenTabs.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel
                      className="text-muted-foreground py-1 text-xs font-medium"
                      style={fontSizeStyle}
                    >
                      {closedTabsLabel}
                    </DropdownMenuLabel>
                    <DropdownTabItems
                      tabs={filteredClosedTabs}
                      onTabClick={handleTabClick}
                      renderLabel={renderSearchItemLabel}
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
                    renderLabel={renderSearchItemLabel}
                    renderActions={renderOpenTabActions}
                  />
                  {closedTabsList.length > 0 && (
                    <>
                      {openTabsList.length > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel
                        className="text-muted-foreground py-1 text-xs font-medium"
                        style={fontSizeStyle}
                      >
                        {closedTabsLabel}
                      </DropdownMenuLabel>
                      <DropdownTabItems
                        tabs={closedTabsList}
                        onTabClick={handleTabClick}
                        renderLabel={renderSearchItemLabel}
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
                  renderLabel={renderSearchItemLabel}
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
  renderLabel?: (tab: TabDescriptor) => React.ReactNode;
  renderActions?: (tab: TabDescriptor) => React.ReactNode;
  getItemClassName?: (tab: TabDescriptor) => string | undefined;
}

function DropdownTabItems({
  tabs,
  emptyMessage,
  onTabClick,
  renderLabel,
  renderActions,
  getItemClassName,
}: DropdownTabItemsProps) {
  const {fontSize} = useTabStripContext();
  const fontSizeStyle = getFontSizeStyle(fontSize);

  if (tabs.length === 0) {
    if (!emptyMessage) return null;
    return (
      <DropdownMenuLabel
        className="items-center justify-center text-xs"
        style={fontSizeStyle}
      >
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
          style={fontSizeStyle}
        >
          <div className="min-w-0 truncate pl-1 text-xs" style={fontSizeStyle}>
            {renderLabel ? renderLabel(tab) : tab.name}
          </div>
          {renderActions && (
            <div className="flex items-center gap-2">{renderActions(tab)}</div>
          )}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/**
 * A general-purpose button for the tab strip.
 */
const TabStripButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function TabStripButtonComponent({className, style, ...props}, ref) {
    const context = useOptionalTabStripContext();

    return (
      <Button
        ref={ref}
        size="icon"
        variant="ghost"
        style={mergeFontSizeStyle(context?.fontSize, style)}
        className={cn(
          ...TAB_STRIP_BUTTON_CLASSNAMES,
          'h-full shrink-0',
          className,
        )}
        {...props}
      />
    );
  },
);
TabStripButton.displayName = 'TabStripButton';
type TabStripNewButtonProps = ButtonProps & {
  /** Optional tooltip content for the button. */
  tooltip?: React.ReactNode;
};

/**
 * Renders a button to create a new tab.
 */
function TabStripNewButton({tooltip, ...props}: TabStripNewButtonProps) {
  const {onCreate, fontSize} = useTabStripContext();

  if (!onCreate) {
    return null;
  }

  const button = (
    <TabStripButton
      {...props}
      style={mergeFontSizeStyle(fontSize, props.style)}
      aria-label={props['aria-label'] || 'Create new tab'}
      onClick={(e) => {
        onCreate();
        props.onClick?.(e);
      }}
    >
      <PlusIcon className="h-4 w-4" />
    </TabStripButton>
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
  /** Whether tabs can be closed. Defaults to true. */
  closeable?: boolean;
  /** Called when a tab is closed (hidden, can be reopened). */
  onClose?: (tabId: string) => void;
  /** Called when the list of open tabs changes (open from dropdown or reorder). */
  onOpenTabsChange?: (tabIds: string[]) => void;
  /** Called when a tab is selected. */
  onSelect?: (tabId: string) => void;
  /** Called when a tab trigger is clicked, including the already-selected tab. */
  onActivate?: (tabId: string) => void;
  /** Called when a new tab should be created. */
  onCreate?: () => void;
  /** Called when a tab is renamed inline. */
  onRename?: (tabId: string, newName: string) => void;
  /** Render function for the tab's dropdown menu. Use TabStrip.MenuItem and TabStrip.MenuSeparator. */
  renderTabMenu?: (tab: TabDescriptor) => React.ReactNode;
  /** Render function for search dropdown item actions. Use TabStrip.SearchItemAction. */
  renderSearchItemActions?: (tab: TabDescriptor) => React.ReactNode;
  /** Render function for custom search dropdown item labels. */
  renderSearchItemLabel?: (tab: TabDescriptor) => React.ReactNode;
  /** Render function for custom tab content. Receives the tab and returns the content to display. */
  renderTabLabel?: (tab: TabDescriptor) => React.ReactNode;
  /** Font size applied to tab labels, inline editing, and TabStrip subcomponents. */
  fontSize?: React.CSSProperties['fontSize'];
  /** Whether this tab strip owns its dnd context or participates in a shared parent context. */
  dndMode?: TabStripDndMode;
  /** Unique scope for shared dnd tab ids. Defaults to a generated component id. */
  dndScopeId?: string;
  /** Extra drag payload attached to tab drags; may intentionally override `kind`. */
  getTabDragData?: (tab: TabDescriptor) => TabStripDragData | undefined;
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
  closeable = true,
  onClose,
  onOpenTabsChange,
  onSelect,
  onActivate,
  onCreate,
  onRename,
  renderTabMenu,
  renderSearchItemActions,
  renderSearchItemLabel,
  renderTabLabel,
  fontSize,
  dndMode = 'internal',
  dndScopeId,
  getTabDragData,
}: TabStripProps) {
  const generatedDndScopeId = useId();
  const actualDndScopeId = dndScopeId ?? generatedDndScopeId;
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
        // @ts-expect-error - scrollMode is not standardized yet
        scrollMode: 'if-needed',
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
    closeable,
    getLastOpenedAt: (tabId) => lastOpenedAtRef.current.get(tabId),
    dndMode,
    dndScopeId: actualDndScopeId,
    getTabDragData,
    fontSize,
    onOpenTabsChange,
    onSelect,
    onActivate,
    onCreate,
    onRename,
    renderTabMenu,
    renderSearchItemActions,
    renderSearchItemLabel,
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
      style={getFontSizeStyle(fontSize)}
    >
      <TabStripContext.Provider value={contextValue}>
        <TabsList
          className={cn(
            'flex h-9 w-full min-w-0 items-center justify-start gap-2 overflow-visible bg-transparent p-1',
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
  Button: TabStripButton,
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
