import {DataTableModal} from '@sqlrooms/data-table';
import {
  getRawSqlTableReference,
  getTableDisplayName,
  getTableIdentity,
  type DataTable,
  type DbSchemaNode,
  type TableNodeObject,
} from '@sqlrooms/duckdb';
import {
  defaultRenderTableNodeMenuItems,
  defaultRenderTableSchemaNode,
  TableSchemaTree,
  TableTreeNode,
  TreeNodeActionsMenuItem,
} from '@sqlrooms/schema-tree';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  ScrollArea,
  ScrollBar,
  toast,
  useDisclosure,
  useSidebar,
} from '@sqlrooms/ui';
import {ArrowUpFromLine, Database, Table2, Trash2Icon} from 'lucide-react';
import {useCallback, useRef, useState, type ChangeEvent} from 'react';
import {useRoomStore} from '../../store';
import {
  LOCAL_DATA_ACCEPTED_FORMATS,
  useLocalFileLoader,
} from '../../components/useLocalFileLoader';

const acceptedDataFileExtensions = Object.values(LOCAL_DATA_ACCEPTED_FORMATS)
  .flat()
  .join(',');
const CLI_SIDEBAR_COMMAND_ITEM_CLASS = 'cli-sidebar-command-item';

export function CliDataSidebarSection() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadLocalFiles = useLocalFileLoader();
  const selectTable = useRoomStore((state) => state.sqlEditor.selectTable);
  const tables = useRoomStore((state) => state.db.tables);
  const schemaTrees = useRoomStore((state) => state.db.schemaTrees);
  const dropTable = useRoomStore((state) => state.db.dropTable);
  const {state} = useSidebar();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [previewTable, setPreviewTable] = useState<DataTable | undefined>();
  const [deleteTable, setDeleteTable] = useState<TableNodeObject | null>(null);
  const [isDeletingTable, setIsDeletingTable] = useState(false);
  const tableModal = useDisclosure();
  const {onOpen: openTableModal} = tableModal;

  const addData = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = '';
      if (files.length > 0) {
        void loadLocalFiles(files);
      }
    },
    [loadLocalFiles],
  );

  const handleSelectTable = useCallback(
    (table: DataTable) => {
      selectTable(getTableIdentity(table.table));
    },
    [selectTable],
  );

  const handlePreviewTable = useCallback(
    (table: DataTable) => {
      handleSelectTable(table);
      setPreviewTable(table);
      setPopoverOpen(false);
      openTableModal();
    },
    [handleSelectTable, openTableModal],
  );

  const renderSchemaNode = useCallback((node: DbSchemaNode) => {
    if (node.object.type !== 'table') {
      return defaultRenderTableSchemaNode(node);
    }

    return (
      <TableTreeNode
        nodeObject={node.object}
        renderMenuItems={(nodeObject, viewTableModal) => (
          <>
            {defaultRenderTableNodeMenuItems(nodeObject, viewTableModal)}
            {!nodeObject.isView && (
              <>
                <DropdownMenuSeparator />
                <TreeNodeActionsMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    setDeleteTable(nodeObject);
                  }}
                >
                  <Trash2Icon width="15px" />
                  Delete table
                </TreeNodeActionsMenuItem>
              </>
            )}
          </>
        )}
      />
    );
  }, []);

  const handleConfirmDeleteTable = useCallback(async () => {
    if (!deleteTable) return;

    const tableToDelete = deleteTable;
    const loadingToastId = toast.loading('Deleting table...', {
      description: getTableDisplayName(tableToDelete.table),
    });
    setIsDeletingTable(true);
    try {
      await dropTable(tableToDelete.table);
      setDeleteTable(null);
      toast.success('Table deleted', {
        description: tableToDelete.table.table,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error('Failed to delete table', {
        description: errorMessage,
      });
    } finally {
      setIsDeletingTable(false);
      toast.dismiss(loadingToastId);
    }
  }, [deleteTable, dropTable]);

  return (
    <>
      {state === 'expanded' ? (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col py-1 pr-0 pl-0">
            <SchemaExplorer.Header title="Data">
              <SchemaExplorer.RefreshButton />
            </SchemaExplorer.Header>
            <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!w-full [&_[data-radix-scroll-area-viewport]>div]:!min-w-0">
              <TableSchemaTree
                schemaTrees={schemaTrees}
                className="overflow-visible"
                renderNode={renderSchemaNode}
              />
              <ScrollBar orientation="vertical" />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
          <SidebarMenu className="shrink-0">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-primary hover:text-primary border-sidebar-border bg-sidebar-accent/50 hover:bg-sidebar-accent h-10 justify-center border"
                onClick={addData}
                type="button"
              >
                <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                <span>Add data</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      ) : (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
              type="button"
              size="lg"
              aria-label="Data"
            >
              <Database className="h-4 w-4" aria-hidden />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0"
            align="start"
            side="right"
            sideOffset={10}
          >
            <Command>
              <CommandInput placeholder="Search tables..." />
              <CommandList className="max-h-none overflow-hidden">
                <CommandEmpty>No tables found.</CommandEmpty>
                <ScrollArea className="h-[min(70vh,360px)] overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block">
                  <CommandGroup heading="Tables">
                    {tables.map((table) => (
                      <CommandItem
                        className={CLI_SIDEBAR_COMMAND_ITEM_CLASS}
                        key={getTableIdentity(table.table)}
                        value={`${getTableIdentity(table.table)} ${formatTableMeta(table)}`}
                        onSelect={() => {
                          handlePreviewTable(table);
                        }}
                      >
                        <Table2 className="h-4 w-4" aria-hidden />
                        <div className="grid min-w-0 gap-px">
                          <span className="truncate">{table.table.table}</span>
                          <small className="text-muted-foreground truncate text-xs">
                            {formatTableMeta(table)}
                          </small>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </ScrollArea>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    className={CLI_SIDEBAR_COMMAND_ITEM_CLASS}
                    value="add data import file"
                    onSelect={() => {
                      addData();
                      setPopoverOpen(false);
                    }}
                  >
                    <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                    Add data
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      <DataTableModal
        title={previewTable?.table.table}
        query={
          previewTable
            ? `SELECT * FROM ${getRawSqlTableReference(previewTable.table)}`
            : ''
        }
        tableModal={tableModal}
      />
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        multiple
        accept={acceptedDataFileExtensions}
        onChange={handleFileInputChange}
        tabIndex={-1}
      />
      <DeleteTableDialog
        table={deleteTable}
        isDeleting={isDeletingTable}
        onOpenChange={(open) => {
          if (!open && !isDeletingTable) {
            setDeleteTable(null);
          }
        }}
        onConfirm={handleConfirmDeleteTable}
      />
    </>
  );
}

function DeleteTableDialog({
  table,
  isDeleting,
  onOpenChange,
  onConfirm,
}: {
  table: TableNodeObject | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={table !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete table</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;
            {table?.table.table ?? 'this table'}&rdquo;? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatTableMeta(table: DataTable) {
  const columnCount = table.columns.length;
  const columnLabel = `${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`;
  if (table.rowCount === undefined) return columnLabel;
  return `${columnLabel}, ${table.rowCount.toLocaleString()} ${
    table.rowCount === 1 ? 'row' : 'rows'
  }`;
}
