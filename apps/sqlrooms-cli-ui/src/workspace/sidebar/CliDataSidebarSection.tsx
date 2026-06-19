import {DataTableModal} from '@sqlrooms/data-table';
import {type DataTable} from '@sqlrooms/duckdb';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  ScrollArea,
  ScrollBar,
  useSidebar,
  useDisclosure,
} from '@sqlrooms/ui';
import {ArrowUpFromLine, Database, Table2} from 'lucide-react';
import {useCallback, useRef, useState, type ChangeEvent} from 'react';
import {useRoomStore} from '../../store';
import {
  LOCAL_DATA_ACCEPTED_FORMATS,
  useLocalFileLoader,
} from '../../components/useLocalFileLoader';

const acceptedDataFileExtensions = Object.values(LOCAL_DATA_ACCEPTED_FORMATS)
  .flat()
  .join(',');

export function CliDataSidebarSection() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadLocalFiles = useLocalFileLoader();
  const selectTable = useRoomStore((state) => state.sqlEditor.selectTable);
  const tables = useRoomStore((state) => state.db.tables);
  const {state} = useSidebar();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [previewTable, setPreviewTable] = useState<DataTable | undefined>();
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
      selectTable(table.table.toString());
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

  return (
    <>
      {state === 'expanded' ? (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <SidebarMenu>
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
          <div className="flex min-h-0 flex-1 flex-col py-1 pr-0 pl-0">
            <SchemaExplorer.Header title="Data">
              <SchemaExplorer.RefreshButton />
            </SchemaExplorer.Header>
            <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:!w-full [&_[data-radix-scroll-area-viewport]>div]:!min-w-0">
              <SchemaExplorer.Tree />
              <ScrollBar orientation="vertical" />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
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
            sideOffset={8}
          >
            <Command>
              <CommandInput placeholder="Search tables..." />
              <CommandList className="max-h-none overflow-hidden">
                <CommandEmpty>No tables found.</CommandEmpty>
                <ScrollArea className="h-[min(70vh,360px)] overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block">
                  <CommandGroup heading="Tables">
                    {tables.map((table) => (
                      <CommandItem
                        key={table.table.toString()}
                        value={`${table.table.toString()} ${formatTableMeta(table)}`}
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
          previewTable ? `SELECT * FROM ${previewTable.table.toString()}` : ''
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
    </>
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
