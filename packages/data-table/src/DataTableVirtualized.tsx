import {ChevronDownIcon, ChevronUpIcon} from '@heroicons/react/24/solid';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from '@sqlrooms/ui';
import {ErrorPane, SpinnerPane} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';
import {useVirtual} from 'react-virtual';

export type DataTableVirtualizedProps<Data extends object> = {
  data?: ArrayLike<Data>;
  columns?: ColumnDef<Data, any>[];
  isFetching?: boolean;
  error?: any;
  isPreview?: boolean;
};

export type DataTableProps<Data extends object> = {
  data: ArrayLike<Data>;
  columns: ColumnDef<Data, any>[];
  isPreview?: boolean;
};

const DataTableVirtualized = React.memo(function DataTableVirtualized<
  Data extends object,
>({data, columns, isPreview}: DataTableProps<Data>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    columns,
    data: data as Data[],
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const {rows} = table.getRowModel();
  const rowVirtualizer = useVirtual({
    parentRef: tableContainerRef,
    size: rows.length,
    overscan: 20,
  });
  const {virtualItems: virtualRows, totalSize} = rowVirtualizer;

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="border-border overflow-hidden border">
        <div ref={tableContainerRef} className="h-full overflow-auto">
          <Table disableWrapper>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead
                    className={`bg-background sticky left-0 top-0 z-20 w-auto whitespace-nowrap border-r py-2 text-center`}
                  />
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as any;
                    return (
                      <TableHead
                        key={header.id}
                        className={`bg-background hover:bg-muted/80 sticky top-0 z-10 cursor-pointer whitespace-nowrap border-r px-7 py-2 font-mono ${meta?.isNumeric ? 'text-right' : 'text-left'} `}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div
                          className={`flex items-center gap-1 ${
                            meta?.isNumeric ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
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
                            className="text-[9px] opacity-30"
                          >
                            {String(meta?.type)}
                          </Badge>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {paddingTop > 0 && (
                <TableRow>
                  <TableCell style={{height: `${paddingTop}px`}} />
                </TableRow>
              )}
              {virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <TableRow key={row.id} className="hover:bg-muted/50">
                    <TableCell className="bg-muted text-muted-foreground sticky left-0 border-r text-center text-xs">
                      {virtualRow.index + 1}
                    </TableCell>
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as any;
                      return (
                        <TableCell
                          key={cell.id}
                          className={`max-w-[500px] overflow-hidden truncate border-r px-7 text-xs ${meta?.isNumeric ? 'text-right' : 'text-left'} `}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
              {paddingBottom > 0 && (
                <TableRow>
                  <TableCell style={{height: `${paddingBottom}px`}} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="bg-background sticky bottom-0 left-0 border border-t-0 px-4 py-2 font-mono text-xs">
        {`${isPreview ? 'Preview of the first ' : ''}${formatCount(data.length)} rows`}
      </div>
    </div>
  );
});

export default function DataTableWithLoader<Data extends object>(
  props: DataTableVirtualizedProps<Data>,
) {
  const {isPreview, isFetching, error, ...rest} = props;
  const {data, columns} = rest;
  return error ? (
    <ErrorPane error={error} />
  ) : isFetching ? (
    <SpinnerPane h="100%" />
  ) : data && columns ? (
    <DataTableVirtualized
      data={data}
      columns={columns as any}
      isPreview={isPreview}
    />
  ) : null;
}
