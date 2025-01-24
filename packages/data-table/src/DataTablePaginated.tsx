import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid';
import {
  Button,
  Input,
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
  Badge,
} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import {
  ColumnDef,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {useEffect, useMemo, useState} from 'react';
import {ArrowColumnMeta} from './useArrowDataTable';

export type DataTablePaginatedProps<Data extends object> = {
  data?: ArrayLike<Data> | undefined;
  columns?: ColumnDef<Data, any>[] | undefined;
  pageCount?: number | undefined;
  numRows?: number | undefined;
  isFetching?: boolean;
  isExporting?: boolean;
  pagination?: PaginationState;
  sorting?: SortingState;
  onPaginationChange?: (pagination: PaginationState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onExport?: () => void;
};

export default function DataTablePaginated<Data extends object>({
  data,
  columns,
  pageCount,
  numRows,
  pagination,
  sorting,
  onPaginationChange,
  onSortingChange,
  onExport,
  isExporting,
  isFetching,
}: DataTablePaginatedProps<Data>) {
  const defaultData = useMemo(() => [], []);
  const table = useReactTable({
    data: (data ?? defaultData) as any[],
    columns: columns ?? [],
    pageCount: pageCount ?? -1,
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: (update) => {
      if (onSortingChange && sorting && typeof update === 'function') {
        onSortingChange(update(sorting));
      }
    },
    onPaginationChange: (update) => {
      if (onPaginationChange && pagination && typeof update === 'function') {
        onPaginationChange(update(pagination));
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    state: {
      pagination,
      sorting,
    },
  });

  const [internalPageIndex, setInternalPageIndex] = useState(
    pagination?.pageIndex ?? 0,
  );
  useEffect(() => {
    setInternalPageIndex(pagination?.pageIndex ?? 0);
  }, [pagination?.pageIndex]);

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex-1 overflow-hidden border border-border font-mono">
        <div className="overflow-auto h-full">
          <Table disableWrapper>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead
                    className={`
                      sticky top-0 left-0 w-auto whitespace-nowrap py-2 
                      bg-background border-r text-center z-20
                    `}
                  >
                    {isFetching ? (
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    ) : null}
                  </TableHead>
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef
                      .meta as ArrowColumnMeta;
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className={`
                          sticky top-0 w-auto whitespace-nowrap cursor-pointer py-2 
                          bg-background border-r hover:bg-muted/80 z-10
                          ${meta?.isNumeric ? 'text-right' : 'text-left'}
                        `}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex gap-2 items-center">
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
                            className="opacity-30 text-[9px] max-w-[70px] truncate"
                          >
                            {String(meta?.type)}
                          </Badge>
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="sticky top-0 w-full whitespace-nowrap py-2 bg-background border-r border-t" />
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row, i) => (
                <TableRow key={row.id} className="hover:bg-muted/50">
                  <TableCell className="text-xs border-r bg-muted text-center text-muted-foreground sticky left-0">
                    {pagination
                      ? `${pagination.pageIndex * pagination.pageSize + i + 1}`
                      : ''}
                  </TableCell>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ArrowColumnMeta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={`
                          text-[11px] border-r max-w-[500px] overflow-hidden truncate px-7
                          ${meta?.isNumeric ? 'text-right' : 'text-left'}
                        `}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="border-r">&nbsp;</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="sticky bottom-0 left-0 bg-background p-2 flex gap-2 items-center flex-wrap border border-t-0">
        <Button
          variant="outline"
          size="icon"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronDoubleLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <div className="flex items-center text-sm ml-1 gap-1">
          <div>Page</div>
          <Input
            type="number"
            min={1}
            max={table.getPageCount()}
            className="w-16 h-8"
            value={internalPageIndex + 1}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                const page = Math.max(
                  0,
                  Math.min(table.getPageCount() - 1, Number(value) - 1),
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
          variant="outline"
          size="icon"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          <ChevronDoubleRightIcon className="h-4 w-4" />
        </Button>
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger className="w-[110px] h-8">
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

        <div className="flex-1" />

        {numRows !== undefined && isFinite(numRows) ? (
          <div className="text-sm font-normal">
            {`${formatCount(numRows)} rows`}
          </div>
        ) : null}

        {onExport ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
            ) : (
              <ArrowDownIcon className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
        ) : null}
      </div>
      {isFetching ? (
        <div className="absolute inset-0 bg-background/80 animate-pulse" />
      ) : null}
    </div>
  );
}
