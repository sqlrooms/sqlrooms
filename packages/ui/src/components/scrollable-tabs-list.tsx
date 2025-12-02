import React, {useEffect, useMemo, useRef, useState} from 'react';
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

export interface ScrollableTabDescriptor {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ScrollableTabsRowProps<
  TTab extends ScrollableTabDescriptor = ScrollableTabDescriptor,
> {
  tabs: TTab[];
  editingTabId: string | null;
  onStartEditing: (tabId: string) => void;
  onStopEditing: () => void;
  onInlineRename: (tab: TTab, newName: string) => void;
  onCloseTab?: (tab: TTab) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function ScrollableTabsRow<
  TTab extends ScrollableTabDescriptor = ScrollableTabDescriptor,
>({
  tabs,
  editingTabId,
  onStartEditing,
  onStopEditing,
  onInlineRename,
  onCloseTab,
  scrollContainerRef,
}: ScrollableTabsRowProps<TTab>) {
  return (
    <div
      ref={scrollContainerRef}
      className="flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden pr-1 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => (
        <TabsTrigger
          key={tab.id}
          value={tab.id}
          className="data-[state=inactive]:hover:bg-primary/5 flex h-full min-w-[100px] max-w-[200px] flex-shrink-0 items-center justify-between gap-2 overflow-hidden rounded-b-none py-0 pl-4 pr-2 font-normal data-[state=active]:shadow-none"
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
                onChange={(newName) => onInlineRename(tab, newName)}
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

interface ScrollableTabsDropdownProps<
  TTab extends ScrollableTabDescriptor = ScrollableTabDescriptor,
> {
  search: string;
  onSearchChange: (value: string) => void;
  openedTabs: TTab[];
  closedTabs: TTab[];
  onOpenTab?: (tab: TTab) => void;
  onRequestRename?: (tab: TTab) => void;
  onDeleteTab?: (tab: TTab) => void;
}

function ScrollableTabsDropdown<
  TTab extends ScrollableTabDescriptor = ScrollableTabDescriptor,
>({
  search,
  onSearchChange,
  openedTabs,
  closedTabs,
  onOpenTab,
  onRequestRename,
  onDeleteTab,
}: ScrollableTabsDropdownProps<TTab>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="ml-2 h-5 w-5 flex-shrink-0"
        >
          <ListCollapseIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="max-h-[400px] max-w-[240px] overflow-y-auto"
      >
        <div className="flex items-center gap-1 px-2">
          <SearchIcon className="text-muted-foreground" size={14} />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
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
          {renderDropdownItems(
            closedTabs,
            'No closed tabs',
            onOpenTab,
            onRequestRename,
            onDeleteTab,
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            Opened
          </DropdownMenuLabel>
          {renderDropdownItems(
            openedTabs,
            'No opened tabs',
            onOpenTab,
            onRequestRename,
            onDeleteTab,
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function renderDropdownItems<
  TTab extends ScrollableTabDescriptor = ScrollableTabDescriptor,
>(
  tabs: TTab[],
  emptyMessage: string,
  onOpenTab?: (tab: TTab) => void,
  onRequestRename?: (tab: TTab) => void,
  onDeleteTab?: (tab: TTab) => void,
) {
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

  return tabs.map((tab) => (
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
  ));
}

export interface ScrollableTabsListProps<
  TTab extends ScrollableTabDescriptor = ScrollableTabDescriptor,
> {
  className?: string;
  openedTabs: TTab[];
  closedTabs?: TTab[];
  selectedTabId?: string | null;
  onCloseTab?: (tab: TTab) => void;
  onOpenTab?: (tab: TTab) => void;
  onCreateTab?: () => void;
  onRenameTab?: (tab: TTab, newName: string) => void;
  onRequestRename?: (tab: TTab) => void;
  onDeleteTab?: (tab: TTab) => void;
}

export const ScrollableTabsList = <
  TTab extends ScrollableTabDescriptor = ScrollableTabDescriptor,
>({
  className,
  openedTabs,
  closedTabs = [],
  selectedTabId,
  onCloseTab,
  onOpenTab,
  onCreateTab,
  onRenameTab,
  onRequestRename,
  onDeleteTab,
}: ScrollableTabsListProps<TTab>) => {
  const [search, setSearch] = useState('');
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);

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

  return (
    <TabsList
      className={cn(
        'flex min-w-0 justify-start gap-1 bg-transparent p-0 pt-1.5',
        className,
      )}
    >
      <ScrollableTabsRow
        tabs={openedTabs}
        editingTabId={editingTabId}
        onStartEditing={handleStartEditing}
        onStopEditing={handleStopEditing}
        onInlineRename={handleInlineRename}
        onCloseTab={onCloseTab}
        scrollContainerRef={scrollContainerRef}
      />

      <ScrollableTabsDropdown
        search={search}
        onSearchChange={setSearch}
        openedTabs={filteredOpenedTabs}
        closedTabs={filteredClosedTabs}
        onOpenTab={onOpenTab}
        onRequestRename={onRequestRename}
        onDeleteTab={onDeleteTab}
      />

      {onCreateTab && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onCreateTab}
          className="h-5 w-5 flex-shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      )}
    </TabsList>
  );
};
