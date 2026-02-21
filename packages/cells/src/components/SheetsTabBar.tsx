import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TabStrip,
  TabDescriptor,
} from '@sqlrooms/ui';
import {
  FileText,
  LayoutDashboard,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import React, {useCallback, useMemo, useState} from 'react';
import {useCellsStore} from '../hooks';
import {SheetType} from '../types';
import {DeleteSheetModal} from './DeleteSheetModal';

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
  const closeSheet = useCellsStore((s) => s.cells.closeSheet);
  const openSheet = useCellsStore((s) => s.cells.openSheet);
  const setSheetOrder = useCellsStore((s) => s.cells.setSheetOrder);
  const renameSheet = useCellsStore((s) => s.cells.renameSheet);
  const setCurrentSheet = useCellsStore((s) => s.cells.setCurrentSheet);

  const [sheetToDelete, setSheetToDelete] = useState<string | null>(null);

  const handleDeleteRequest = useCallback(
    (sheetId: string) => {
      const sheet = sheets[sheetId];
      if (sheet && sheet.cellIds.length === 0) {
        removeSheet(sheetId);
      } else {
        setSheetToDelete(sheetId);
      }
    },
    [sheets, removeSheet],
  );

  const handleConfirmDelete = useCallback(() => {
    if (sheetToDelete) {
      removeSheet(sheetToDelete);
      setSheetToDelete(null);
    }
  }, [sheetToDelete, removeSheet]);

  const tabs = useMemo(
    () =>
      Object.values(sheets).map((sheet) => ({
        id: sheet.id,
        name: sheet.title || 'Untitled',
        type: sheet.type || 'notebook',
      })),
    [sheets],
  );

  return (
    <TabStrip
      className={className}
      tabs={tabs}
      openTabs={sheetOrder}
      selectedTabId={currentSheetId}
      onSelect={setCurrentSheet}
      onRename={renameSheet}
      onClose={closeSheet}
      onOpenTabsChange={setSheetOrder}
      renderTabTitle={(tab: TabDescriptor) => {
        const Icon = TYPE_ICONS[tab.type as SheetType] || FileText;
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
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
            onClick={() => handleDeleteRequest(tab.id)}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </TabStrip.MenuItem>
        </>
      )}
      renderSearchItemActions={(tab) => (
        <>
          <TabStrip.SearchItemAction
            icon={<PencilIcon className="h-3 w-3" />}
            aria-label={`Rename ${tab.name}`}
            onClick={() => renameSheet(tab.id, tab.name)}
          />
          <TabStrip.SearchItemAction
            icon={<TrashIcon className="h-3 w-3" />}
            aria-label={`Delete ${tab.name}`}
            onClick={() => handleDeleteRequest(tab.id)}
          />
        </>
      )}
    >
      <TabStrip.SearchDropdown />
      <TabStrip.Tabs tabClassName="pl-2" />

      {supportedTypes.length === 1 ? (
        <AddNewSheetButton
          onClick={() => addSheet(undefined, supportedTypes[0])}
        />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AddNewSheetButton />
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
      )}
      <DeleteSheetModal
        isOpen={sheetToDelete !== null}
        onClose={() => setSheetToDelete(null)}
        onConfirm={handleConfirmDelete}
        sheetTitle={sheetToDelete ? sheets[sheetToDelete]?.title : undefined}
      />
    </TabStrip>
  );
};

const AddNewSheetButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>(({className, ...props}, ref) => {
  return (
    <Button
      ref={ref}
      size="icon"
      variant="ghost"
      className={`hover:bg-primary/10 h-full w-8 rounded-none ${className ?? ''}`}
      {...props}
    >
      <PlusIcon className="h-4 w-4" />
    </Button>
  );
});
AddNewSheetButton.displayName = 'AddNewSheetButton';
