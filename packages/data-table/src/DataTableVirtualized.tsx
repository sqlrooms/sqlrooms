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
import {ErrorPane, SpinnerPane} from '@sqlrooms/components';
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

export type Props<Data extends object> = {
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
      <div className="overflow-hidden border border-border">
        <div ref={tableContainerRef} className="overflow-auto h-full">
          <Table disableWrapper>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <TableHead
                    className={`
                      sticky top-0 left-0 w-auto whitespace-nowrap py-2 
                      bg-background border-r text-center z-20
                    `}
                  />
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as any;
                    return (
                      <TableHead
                        key={header.id}
                        className={`
                          sticky top-0 font-mono whitespace-nowrap cursor-pointer px-7 py-2
                          bg-background border-r hover:bg-muted/80 z-10
                          ${meta?.isNumeric ? 'text-right' : 'text-left'}
                        `}
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
                            className="opacity-30 text-[9px]"
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
                    <TableCell className="text-xs border-r bg-muted text-center text-muted-foreground sticky left-0">
                      {virtualRow.index + 1}
                    </TableCell>
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as any;
                      return (
                        <TableCell
                          key={cell.id}
                          className={`
                            text-xs border-r max-w-[500px] overflow-hidden truncate px-7
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
      <div className="sticky bottom-0 left-0 py-2 px-4 text-xs font-mono bg-background border border-t-0">
        {`${isPreview ? 'Preview of the first ' : ''}${formatCount(data.length)} rows`}
      </div>
    </div>
  );
});

export default function DataTableWithLoader<Data extends object>(
  props: Props<Data>,
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
