import {
  getAllTablesFromSchemaTrees,
  makeQualifiedTableName,
  type TableNodeObject,
} from '@sqlrooms/duckdb';
import {SchemaExplorer} from '@sqlrooms/sql-editor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  ScrollArea,
  ScrollBar,
  useSidebar,
} from '@sqlrooms/ui';
import {ArrowUpFromLine, Database, Table2} from 'lucide-react';
import {useCallback, useMemo, useRef, type ChangeEvent} from 'react';
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
  const schemaTrees = useRoomStore((state) => state.db.schemaTrees);
  const selectTable = useRoomStore((state) => state.sqlEditor.selectTable);
  const tables = useMemo(
    () => getAllTablesFromSchemaTrees(schemaTrees),
    [schemaTrees],
  );
  const {state} = useSidebar();

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
    (table: TableNodeObject) => {
      const qualifiedTableName = makeQualifiedTableName({
        database: table.table.database,
        schema: table.table.schema,
        table: table.table.table,
      }).toString();
      selectTable(qualifiedTableName);
    },
    [selectTable],
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
              type="button"
              size="lg"
              aria-label="Data"
            >
              <Database className="h-4 w-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="bg-popover border-border [&_[role=menuitem]]:focus:bg-accent w-72"
            align="start"
            side="right"
            sideOffset={8}
          >
            <DropdownMenuLabel>Tables</DropdownMenuLabel>
            {tables.map((table) => (
              <DropdownMenuItem
                key={`${table.table.database ?? ''}.${table.table.schema}.${table.table.table}`}
                onClick={() => handleSelectTable(table)}
              >
                <Table2 className="h-4 w-4" aria-hidden />
                <div className="grid min-w-0 gap-px">
                  <span className="truncate">{table.name}</span>
                  <small className="text-muted-foreground truncate text-xs">
                    {formatTableMeta(table)}
                  </small>
                </div>
              </DropdownMenuItem>
            ))}
            {tables.length === 0 ? (
              <DropdownMenuItem disabled>No tables</DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={addData}>
              <ArrowUpFromLine className="h-4 w-4" aria-hidden />
              Add data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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

function formatTableMeta(table: TableNodeObject) {
  const columnCount = table.columns.length;
  const columnLabel = `${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`;
  if (table.rowCount === undefined) return columnLabel;
  return `${columnLabel}, ${table.rowCount.toLocaleString()} ${
    table.rowCount === 1 ? 'row' : 'rows'
  }`;
}
