import {
  Badge,
  Button,
  Checkbox,
  cn,
  Input,
  resolveFontSizeClass,
  ScrollArea,
  ScrollBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronsLeftIcon as ChevronDoubleLeftIcon,
  ChevronsRightIcon as ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowColumnMeta} from './useArrowDataTable';

export type DataTablePaginatedProps<Data extends object> = {
  className?: string;
  /** Custom font size for the table e.g. text-xs, text-sm, text-md, text-lg, text-base */
  fontSize?: string;
  data?: ArrayLike<Data> | undefined;
  columns?: ColumnDef<Data, any>[] | undefined;
  pageCount?: number | undefined;
  numRows?: number | undefined;
  isFetching?: boolean;
  pagination?: PaginationState | undefined;
  sorting?: SortingState;
  footerActions?: React.ReactNode;
  onPaginationChange?: (pagination: PaginationState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  /**
   * Called when a row is clicked.
   */
  onRowClick?: (args: {
    row: Row<Data>;
    event: React.MouseEvent<HTMLTableRowElement>;
  }) => void;
  /**
   * Called when a row is double-clicked.
   */
  onRowDoubleClick?: (args: {
    row: Row<Data>;
    event: React.MouseEvent<HTMLTableRowElement>;
  }) => void;
  /**
   * Enables row selection with checkboxes. When true, a checkbox column is added.
   */
  enableRowSelection?: boolean;
  /**
   * Controlled row selection state. Keys are row indices, values are selection status.
   */
  rowSelection?: RowSelectionState;
  /**
   * Called when row selection changes.
   */
  onRowSelectionChange?: (rowSelection: RowSelectionState) => void;
};

/**
 * Data table with pagination, sorting, row selection, and custom actions.
 */
export default function DataTablePaginated<Data extends object>({
  className,
  fontSize = 'text-xs',
  data,
  columns,
  numRows,
  pagination,
  sorting,
  onPaginationChange,
  onSortingChange,
  footerActions,
  isFetching,
  onRowClick,
  onRowDoubleClick,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
}: DataTablePaginatedProps<Data>) {
  const defaultData = useMemo(() => [], []);
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});

  // Use controlled or uncontrolled row selection
  const currentRowSelection = rowSelection ?? internalRowSelection;
  const currentRowSelectionRef = useRef(currentRowSelection);

  useEffect(() => {
    currentRowSelectionRef.current = currentRowSelection;
  }, [currentRowSelection]);

  const handleRowSelectionChange = useCallback(
    (
      updaterOrValue:
        | RowSelectionState
        | ((old: RowSelectionState) => RowSelectionState),
    ) => {
      if (onRowSelectionChange) {
        const newValue =
          typeof updaterOrValue === 'function'
            ? updaterOrValue(currentRowSelectionRef.current)
            : updaterOrValue;
        onRowSelectionChange(newValue);
      } else {
        setInternalRowSelection(updaterOrValue);
      }
    },
    [onRowSelectionChange, setInternalRowSelection],
  );

  const fontSizeClass = resolveFontSizeClass(fontSize);
  const pageCount =
    pagination && numRows !== undefined
      ? Math.ceil(numRows / pagination.pageSize)
      : undefined;

  const table = useReactTable({
    data: (data ?? defaultData) as any[],
    columns: columns ?? [],
    pageCount: pageCount ?? 0,
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: enableRowSelection ?? false,
    onRowSelectionChange: (update) => {
      handleRowSelectionChange(update);
    },
    onSortingChange: (update) => {
      if (onSortingChange && sorting && typeof update === 'function') {
        onSortingChange(update(sorting));
      }
    },
    onPaginationChange: (update) => {
      if (pagination && onPaginationChange && typeof update === 'function') {
        onPaginationChange(update(pagination));
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    state: {
      pagination,
      sorting,
      rowSelection: currentRowSelection,
    },
  });

  const [internalPageIndex, setInternalPageIndex] = useState(
    pagination?.pageIndex ?? 0,
  );
  useEffect(() => {
    setInternalPageIndex(pagination?.pageIndex ?? 0);
  }, [pagination?.pageIndex]);

  return (
    <div
      className={cn(`relative flex h-full w-full flex-col border`, className)}
    >
      <div
        className={cn(
          'flex-1 overflow-hidden font-mono',
          isFetching && 'pointer-events-none opacity-50',
        )}
      >
        <ScrollArea className="h-full overflow-auto">
          <Table disableWrapper>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead
                    className={`bg-background sticky -top-px left-0 z-10 w-auto border-r py-2 text-center whitespace-nowrap`}
                  >
                    {isFetching ? (
                      <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                    ) : null}
                  </TableHead>
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef
                      .meta as ArrowColumnMeta;
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className={cn(
                          'bg-background hover:bg-muted sticky -top-px z-10 w-auto border-r py-2 whitespace-nowrap',
                          pagination ? 'cursor-pointer' : '',
                          meta?.isNumeric ? 'text-right' : 'text-left',
                          fontSizeClass,
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-2">
                          {header.isPlaceholder ? null : (
                            <div>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                            </div>
                          )}
                          {header.column.getIsSorted() ? (
                            header.column.getIsSorted() === 'desc' ? (
                              <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                              <ChevronUpIcon className="h-4 w-4" />
                            )
                          ) : null}
                          <div className="flex-1" />
                          <Badge
                            variant="outline"
                            className={`max-w-[400px] truncate text-xs opacity-30`}
                          >
                            {String(meta?.type)}
                          </Badge>
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="bg-background sticky -top-px w-full border-t border-r py-2 whitespace-nowrap" />
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row, i) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(
                    'hover:bg-muted bg-background',
                    row.getIsSelected() && 'bg-muted',
                  )}
                  onClick={
                    onRowClick
                      ? (event) => {
                          event.preventDefault();
                          onRowClick({row: row as Row<Data>, event});
                        }
                      : undefined
                  }
                  onDoubleClick={
                    onRowDoubleClick
                      ? (event) => {
                          event.preventDefault();
                          onRowDoubleClick({row: row as Row<Data>, event});
                        }
                      : undefined
                  }
                >
                  <TableCell
                    className={`bg-background text-muted-foreground sticky left-0 border-r text-center ${fontSizeClass}`}
                  >
                    {enableRowSelection ? (
                      <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label="Select row"
                      />
                    ) : pagination ? (
                      `${pagination.pageIndex * pagination.pageSize + i + 1}`
                    ) : (
                      `${i + 1}`
                    )}
                  </TableCell>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ArrowColumnMeta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'max-w-[500px] truncate overflow-hidden border-r px-7',
                          fontSizeClass,
                          meta?.isNumeric ? 'text-right' : 'text-left',
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell>&nbsp;</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="vertical" className="z-50" />
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="bg-background sticky bottom-0 left-0 flex h-[45px] items-center gap-2 border-t px-2">
        {isFetching ? (
          <div className="ml-2 text-xs">Loading...</div>
        ) : (
          <>
            {pagination ? (
              <>
                <div className="flex items-center gap-1 truncate">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 w-7"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronDoubleLeftIcon size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 w-7"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeftIcon size={16} />
                  </Button>
                  <div
                    className={`ml-1 flex items-center gap-1 ${fontSizeClass}`}
                  >
                    <div>Page</div>
                    <Input
                      type="number"
                      min={1}
                      max={table.getPageCount()}
                      className="h-7 w-16"
                      value={internalPageIndex + 1}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value) {
                          const page = Math.max(
                            0,
                            Math.min(
                              table.getPageCount() - 1,
                              Number(value) - 1,
                            ),
                          );
                          setInternalPageIndex(page);
                        }
                      }}
                      onBlur={() => {
                        if (internalPageIndex !== pagination?.pageIndex) {
                          table.setPageIndex(internalPageIndex);
                        }
                      }}
                    />
                    <div>{`of ${formatCount(table.getPageCount())}`}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 w-7"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRightIcon size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 w-7"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronDoubleRightIcon size={16} />
                  </Button>
                  <Select
                    value={String(table.getState().pagination.pageSize)}
                    onValueChange={(value) => table.setPageSize(Number(value))}
                  >
                    <SelectTrigger className="hidden h-7 w-[110px] lg:inline-flex">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 50, 100, 500, 1000].map((pageSize) => (
                        <SelectItem key={pageSize} value={String(pageSize)}>
                          {`${pageSize} rows`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 flex-1" />
              </>
            ) : null}

            {numRows !== undefined && isFinite(numRows) ? (
              <div className={`min-w-fit font-normal ${fontSizeClass}`}>
                {`${formatCount(numRows)} rows`}
              </div>
            ) : null}
            {footerActions}
          </>
        )}
      </div>
    </div>
  );
}
