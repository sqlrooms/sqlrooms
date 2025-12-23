import React, {useMemo} from 'react';
import {
  TabStrip,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useTheme,
} from '@sqlrooms/ui';
import {
  FileText,
  LayoutDashboard,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from 'lucide-react';
import {useCellsStore} from '../hooks';
import {SheetType} from '../types';

export type SheetsTabBarProps = {
  className?: string;
};

const TYPE_ICONS: Record<SheetType, React.ElementType> = {
  notebook: FileText,
  canvas: LayoutDashboard,
};

export const SheetsTabBar: React.FC<SheetsTabBarProps> = ({className}) => {
  const sheetOrder = useCellsStore((s) => s.cells.config.sheetOrder);
  const sheets = useCellsStore((s) => s.cells.config.sheets);
  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const supportedTypes = useCellsStore((s) => s.cells.supportedSheetTypes);
  const addSheet = useCellsStore((s) => s.cells.addSheet);
  const removeSheet = useCellsStore((s) => s.cells.removeSheet);
  const renameSheet = useCellsStore((s) => s.cells.renameSheet);
  const setCurrentSheet = useCellsStore((s) => s.cells.setCurrentSheet);

  const tabs = useMemo(
    () =>
      sheetOrder.map((id) => {
        const sheet = sheets[id];
        return {
          id,
          name: sheet?.title || 'Untitled',
          type: sheet?.type || 'notebook',
        };
      }),
    [sheetOrder, sheets],
  );

  return (
    <TabStrip
      className={className}
      tabs={tabs}
      openTabs={sheetOrder}
      selectedTabId={currentSheetId}
      onSelect={setCurrentSheet}
      onRename={renameSheet}
      onClose={removeSheet}
      renderTabTitle={(tab: import('@sqlrooms/ui').TabDescriptor) => {
        const Icon = TYPE_ICONS[tab.type as SheetType] || FileText;
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
            <div className="truncate text-sm">{tab.name}</div>
          </div>
        );
      }}
      renderTabMenu={(tab) => (
        <>
          <TabStrip.MenuItem onClick={() => renameSheet(tab.id, tab.name)}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Rename
          </TabStrip.MenuItem>
          <TabStrip.MenuSeparator />
          <TabStrip.MenuItem
            variant="destructive"
            onClick={() => removeSheet(tab.id)}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </TabStrip.MenuItem>
        </>
      )}
    >
      <TabStrip.SearchDropdown />
      <TabStrip.Tabs tabClassName="pl-2" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="hover:bg-primary/10 h-full w-8 rounded-none"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {supportedTypes.map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <DropdownMenuItem
                key={type}
                onClick={() => addSheet(undefined, type)}
                className="capitalize"
              >
                <Icon className="mr-2 h-4 w-4" />
                New {type}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </TabStrip>
  );
};
