import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ListCollapseIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';

import {Button} from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import {EditableText} from './editable-text';
import {Input} from './input';
import {TabsList, TabsTrigger} from './tabs';
import {cn} from '../lib/utils';

export interface TabDescriptor {
  id: string;
  name: string;
  [key: string]: unknown;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface TabStripContextValue<TTab extends TabDescriptor = TabDescriptor> {
  // Data
  openedTabs: TTab[];
  closedTabs: TTab[];
  filteredOpenedTabs: TTab[];
  filteredClosedTabs: TTab[];
  editingTabId: string | null;
  search: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;

  // Callbacks
  onCloseTab?: (tab: TTab) => void;
  onOpenTab?: (tab: TTab) => void;
  onCreateTab?: () => void;
  onRenameTab?: (tab: TTab, newName: string) => void;
  onRequestRename?: (tab: TTab) => void;
  onDeleteTab?: (tab: TTab) => void;

  // Internal handlers
  setSearch: (value: string) => void;
  handleStartEditing: (tabId: string) => void;
  handleStopEditing: () => void;
  handleInlineRename: (tab: TTab, newName: string) => void;
}

const TabStripContext = createContext<TabStripContextValue | null>(null);

function useTabStripContext<TTab extends TabDescriptor = TabDescriptor>() {
  const context = useContext(TabStripContext);
  if (!context) {
    throw new Error('TabStrip subcomponents must be used within a TabStrip');
  }
  return context as unknown as TabStripContextValue<TTab>;
}

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

interface TabStripTabsProps {
  className?: string;
}

/**
 * Renders the scrollable row of open tabs.
 */
function TabStripTabs({className}: TabStripTabsProps) {
  const {
    openedTabs,
    editingTabId,
    scrollContainerRef,
    onCloseTab,
    handleStartEditing,
    handleStopEditing,
    handleInlineRename,
  } = useTabStripContext();

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden pr-1 [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {openedTabs.map((tab) => (
        <TabsTrigger
          key={tab.id}
          value={tab.id}
          className="data-[state=inactive]:hover:bg-primary/5 flex h-full min-w-[100px] max-w-[200px] flex-shrink-0 items-center justify-between gap-2 overflow-hidden rounded-b-none py-0 pl-4 pr-2 font-normal data-[state=active]:shadow-none"
        >
          <div
            className="flex min-w-0 items-center"
            onDoubleClick={() => handleStartEditing(tab.id)}
          >
            {editingTabId !== tab.id ? (
              <div className="truncate text-sm">{tab.name}</div>
            ) : (
              <EditableText
                value={tab.name}
                onChange={(newName) => handleInlineRename(tab, newName)}
                className="h-6 min-w-0 flex-1 truncate text-sm shadow-none"
                isEditing
                onEditingChange={(isEditing) => {
                  if (!isEditing) {
                    handleStopEditing();
                  }
                }}
              />
            )}
          </div>

          {onCloseTab && (
            <Button
              size="xs"
              variant="ghost"
              className="hover:bg-primary/10 h-4 w-4 p-1"
              onMouseDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
              }}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onCloseTab(tab);
              }}
            >
              <XIcon className="h-5 w-5" />
            </Button>
          )}
        </TabsTrigger>
      ))}
    </div>
  );
}

interface TabStripSearchDropdownProps {
  className?: string;
  triggerClassName?: string;
}

/**
 * Renders the dropdown with search for browsing all tabs.
 */
function TabStripSearchDropdown({
  className,
  triggerClassName,
}: TabStripSearchDropdownProps) {
  const {
    search,
    setSearch,
    filteredOpenedTabs,
    filteredClosedTabs,
    onOpenTab,
    onRequestRename,
    onDeleteTab,
  } = useTabStripContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn('ml-2 h-5 w-5 flex-shrink-0', triggerClassName)}
        >
          <ListCollapseIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        onCloseAutoFocus={(event) => event.preventDefault()}
        className={cn('max-h-[400px] max-w-[240px] overflow-y-auto', className)}
      >
        <div className="flex items-center gap-1 px-2">
          <SearchIcon className="text-muted-foreground" size={14} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            className="border-none text-xs shadow-none focus-visible:ring-0"
            placeholder="Search..."
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            Closed
          </DropdownMenuLabel>
          <DropdownTabItems
            tabs={filteredClosedTabs}
            emptyMessage="No closed tabs"
            onOpenTab={onOpenTab}
            onRequestRename={onRequestRename}
            onDeleteTab={onDeleteTab}
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            Opened
          </DropdownMenuLabel>
          <DropdownTabItems
            tabs={filteredOpenedTabs}
            emptyMessage="No opened tabs"
            onOpenTab={onOpenTab}
            onRequestRename={onRequestRename}
            onDeleteTab={onDeleteTab}
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DropdownTabItemsProps<TTab extends TabDescriptor = TabDescriptor> {
  tabs: TTab[];
  emptyMessage: string;
  onOpenTab?: (tab: TTab) => void;
  onRequestRename?: (tab: TTab) => void;
  onDeleteTab?: (tab: TTab) => void;
}

function DropdownTabItems<TTab extends TabDescriptor = TabDescriptor>({
  tabs,
  emptyMessage,
  onOpenTab,
  onRequestRename,
  onDeleteTab,
}: DropdownTabItemsProps<TTab>) {
  if (tabs.length === 0) {
    return (
      <DropdownMenuItem
        className="items-center justify-center text-xs"
        disabled
      >
        {emptyMessage}
      </DropdownMenuItem>
    );
  }

  return (
    <>
      {tabs.map((tab) => (
        <DropdownMenuItem
          key={tab.id}
          onClick={() => onOpenTab?.(tab)}
          className="flex h-7 cursor-pointer items-center justify-between truncate"
        >
          <span className="xs truncate pl-1">{tab.name}</span>
          <div className="flex items-center gap-1">
            {onRequestRename && (
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground h-3 w-3"
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestRename(tab);
                }}
              >
                <PencilIcon size={12} className="!size-3" />
              </Button>
            )}
            {onDeleteTab && (
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground h-3 w-3"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteTab(tab);
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
  const {onCreateTab} = useTabStripContext();

  if (!onCreateTab) {
    return null;
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={onCreateTab}
      className={cn('h-5 w-5 flex-shrink-0', className)}
    >
      <PlusIcon className="h-4 w-4" />
    </Button>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export interface TabStripProps<TTab extends TabDescriptor = TabDescriptor> {
  className?: string;
  children?: React.ReactNode;
  /** All available tabs. */
  tabs: TTab[];
  /** IDs of tabs that are currently open. */
  openTabIds: string[];
  selectedTabId?: string | null;
  onCloseTab?: (tab: TTab) => void;
  onOpenTab?: (tab: TTab) => void;
  onCreateTab?: () => void;
  onRenameTab?: (tab: TTab, newName: string) => void;
  onRequestRename?: (tab: TTab) => void;
  onDeleteTab?: (tab: TTab) => void;
}

/**
 * A composable tab strip component with search dropdown and tab management.
 *
 * @example
 * // Default layout
 * <TabStrip tabs={tabs} openTabIds={openTabIds} onCloseTab={...} />
 *
 * @example
 * // Custom layout with subcomponents
 * <TabStrip tabs={tabs} openTabIds={openTabIds} onCloseTab={...}>
 *   <TabStrip.Tabs className="flex-1" />
 *   <TabStrip.SearchDropdown />
 *   <TabStrip.NewButton />
 * </TabStrip>
 */
function TabStripRoot<TTab extends TabDescriptor = TabDescriptor>({
  className,
  children,
  tabs,
  openTabIds,
  selectedTabId,
  onCloseTab,
  onOpenTab,
  onCreateTab,
  onRenameTab,
  onRequestRename,
  onDeleteTab,
}: TabStripProps<TTab>) {
  const [search, setSearch] = useState('');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);

  const openTabIdsSet = useMemo(() => new Set(openTabIds), [openTabIds]);

  const openedTabs = useMemo(
    () => tabs.filter((tab) => openTabIdsSet.has(tab.id)),
    [tabs, openTabIdsSet],
  );

  const closedTabs = useMemo(
    () => tabs.filter((tab) => !openTabIdsSet.has(tab.id)),
    [tabs, openTabIdsSet],
  );

  const trimmedSearch = search.trim().toLowerCase();

  const filteredOpenedTabs = useMemo(
    () =>
      trimmedSearch
        ? openedTabs.filter((tab) =>
            tab.name.toLowerCase().includes(trimmedSearch),
          )
        : openedTabs,
    [openedTabs, trimmedSearch],
  );

  const filteredClosedTabs = useMemo(
    () =>
      trimmedSearch
        ? closedTabs.filter((tab) =>
            tab.name.toLowerCase().includes(trimmedSearch),
          )
        : closedTabs,
    [closedTabs, trimmedSearch],
  );

  // Auto-scroll to selected tab
  useEffect(() => {
    if (!selectedTabId) return;
    if (prevSelectedIdRef.current === selectedTabId) return;
    prevSelectedIdRef.current = selectedTabId;

    const container = scrollContainerRef.current;
    if (!container) return;

    const isOpened = openedTabs.some((tab) => tab.id === selectedTabId);
    if (!isOpened) return;

    const frameId = requestAnimationFrame(() => {
      const activeTab = container.querySelector<HTMLElement>(
        '[data-state="active"]',
      );
      if (!activeTab) return;

      const visibleLeft = container.scrollLeft;
      const visibleRight = visibleLeft + container.clientWidth;

      const tabLeft = activeTab.offsetLeft;
      const tabRight = tabLeft + activeTab.offsetWidth;

      if (tabLeft >= visibleLeft && tabRight <= visibleRight) return;

      let newScrollLeft = visibleLeft;

      if (tabLeft < visibleLeft) {
        newScrollLeft = Math.max(0, tabLeft - 10);
      } else if (tabRight > visibleRight) {
        newScrollLeft = Math.min(
          container.scrollWidth - container.clientWidth,
          tabRight - container.clientWidth + 10,
        );
      }

      if (newScrollLeft !== visibleLeft) {
        container.scrollTo({
          left: newScrollLeft,
          behavior: 'smooth',
        });
      }
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [selectedTabId, openedTabs]);

  const handleInlineRename = (tab: TTab, newName: string) => {
    if (!onRenameTab) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === tab.name) {
      setEditingTabId(null);
      return;
    }
    onRenameTab(tab, trimmed);
    setEditingTabId(null);
  };

  const handleStartEditing = (tabId: string) => {
    if (!onRenameTab) return;
    setEditingTabId(tabId);
  };

  const handleStopEditing = () => {
    setEditingTabId(null);
  };

  const contextValue: TabStripContextValue<TTab> = {
    openedTabs,
    closedTabs,
    filteredOpenedTabs,
    filteredClosedTabs,
    editingTabId,
    search,
    scrollContainerRef,
    onCloseTab,
    onOpenTab,
    onCreateTab,
    onRenameTab,
    onRequestRename,
    onDeleteTab,
    setSearch,
    handleStartEditing,
    handleStopEditing,
    handleInlineRename,
  };

  return (
    <TabStripContext.Provider
      value={contextValue as unknown as TabStripContextValue}
    >
      <TabsList
        className={cn(
          'flex min-w-0 justify-start gap-1 bg-transparent p-0 pt-1.5',
          className,
        )}
      >
        {children ?? (
          <>
            <TabStripTabs />
            <TabStripSearchDropdown />
            <TabStripNewButton />
          </>
        )}
      </TabsList>
    </TabStripContext.Provider>
  );
}

// Attach subcomponents
export const TabStrip = Object.assign(TabStripRoot, {
  Tabs: TabStripTabs,
  SearchDropdown: TabStripSearchDropdown,
  NewButton: TabStripNewButton,
});

export type {
  TabStripTabsProps,
  TabStripSearchDropdownProps,
  TabStripNewButtonProps,
};
