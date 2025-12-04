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

  // Callbacks (using tabId)
  onClose?: (tabId: string) => void;
  onOpen?: (tabId: string) => void;
  onCreate?: () => void;
  onRename?: (tabId: string, newName: string) => void;
  onRenameRequest?: (tabId: string) => void;
  onDelete?: (tabId: string) => void;

  // Internal handlers
  setSearch: (value: string) => void;
  handleStartEditing: (tabId: string) => void;
  handleStopEditing: () => void;
  handleInlineRename: (tabId: string, newName: string) => void;
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
    onClose,
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
                onChange={(newName) => handleInlineRename(tab.id, newName)}
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

          {onClose && (
            <Button
              size="xs"
              variant="ghost"
              className="hover:bg-primary/10 h-5 w-5 p-1"
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
    onOpen,
    onRenameRequest,
    onDelete,
  } = useTabStripContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'hover:bg-primary/10 h-full flex-shrink-0',
            triggerClassName,
          )}
        >
          <ListCollapseIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
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
            onOpen={onOpen}
            onRenameRequest={onRenameRequest}
            onDelete={onDelete}
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
            onOpen={onOpen}
            onRenameRequest={onRenameRequest}
            onDelete={onDelete}
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DropdownTabItemsProps<TTab extends TabDescriptor = TabDescriptor> {
  tabs: TTab[];
  emptyMessage: string;
  onOpen?: (tabId: string) => void;
  onRenameRequest?: (tabId: string) => void;
  onDelete?: (tabId: string) => void;
}

function DropdownTabItems<TTab extends TabDescriptor = TabDescriptor>({
  tabs,
  emptyMessage,
  onOpen,
  onRenameRequest,
  onDelete,
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
          onClick={() => onOpen?.(tab.id)}
          className="flex h-7 cursor-pointer items-center justify-between truncate"
        >
          <span className="xs truncate pl-1">{tab.name}</span>
          <div className="flex items-center gap-1">
            {onRenameRequest && (
              <Button
                size="xs"
                variant="ghost"
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
      onClick={onCreate}
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
  selectedTabId?: string | null;
  /** Called when a tab is closed (hidden, can be reopened). */
  onClose?: (tabId: string) => void;
  /** Called when a closed tab is opened (shown). */
  onOpen?: (tabId: string) => void;
  /** Called when a new tab should be created. */
  onCreate?: () => void;
  /** Called when a tab is renamed inline. */
  onRename?: (tabId: string, newName: string) => void;
  /** Called when rename is requested via dropdown (for modal). */
  onRenameRequest?: (tabId: string) => void;
  /** Called when a tab is permanently deleted. */
  onDelete?: (tabId: string) => void;
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
  onCreate,
  onRename,
  onRenameRequest,
  onDelete,
}: TabStripProps) {
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

  const contextValue: TabStripContextValue = {
    openedTabs,
    closedTabs,
    filteredOpenedTabs,
    filteredClosedTabs,
    editingTabId,
    search,
    scrollContainerRef,
    onClose,
    onOpen,
    onCreate,
    onRename,
    onRenameRequest,
    onDelete,
    setSearch,
    handleStartEditing,
    handleStopEditing,
    handleInlineRename,
  };

  return (
    <TabStripContext.Provider value={contextValue}>
      <TabsList
        className={cn(
          'flex min-w-0 justify-start gap-1 gap-2 bg-transparent p-0 pt-1.5',
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
