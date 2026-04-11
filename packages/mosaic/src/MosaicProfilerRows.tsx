import {ArrowCellValue, isNumericArrowType} from '@sqlrooms/data-table';
import {cn, TableBody, TableCell, TableRow} from '@sqlrooms/ui';
import * as arrow from 'apache-arrow';
import {memo} from 'react';
import type {UseMosaicProfilerReturn} from './profiler/types';
import {isProfilerUnsupportedSummaryType} from './profiler/utils';

export type MosaicProfilerRowsProps = {
  className?: string;
  profiler: Pick<
    UseMosaicProfilerReturn,
    'columns' | 'pageTable' | 'pagination' | 'tableError'
  >;
};

const COLUMN_WIDTH_CLASS = 'min-w-[140px] w-[140px] max-w-[140px]';
const ROW_NUMBER_CLASS =
  'bg-background text-muted-foreground sticky left-0 z-10 w-[40px] max-w-[40px] min-w-[40px] border-r px-1 text-center';

function getColumnWidthClass(field: arrow.Field) {
  return isProfilerUnsupportedSummaryType(field.type)
    ? 'min-w-[104px] w-[104px] max-w-[104px]'
    : COLUMN_WIDTH_CLASS;
}

function formatProfilerValue(type: arrow.DataType, value: unknown) {
  if (arrow.DataType.isBinary(type) && value instanceof Uint8Array) {
    return `${value.byteLength} bytes`;
  }
  return undefined;
}

function SizingRow({columns}: {columns: UseMosaicProfilerReturn['columns']}) {
  return (
    <TableRow
      aria-hidden="true"
      className="pointer-events-none h-0 border-0 opacity-0 hover:bg-transparent"
    >
      <TableCell className="w-[40px] max-w-[40px] min-w-[40px] border-r p-0" />
      {columns.map((column) => (
        <TableCell
          key={column.name}
          className={cn(getColumnWidthClass(column.field), 'border-r p-0')}
        />
      ))}
    </TableRow>
  );
}

function EmptyStateRow({
  columns,
  message,
  tone = 'muted',
}: {
  columns: UseMosaicProfilerReturn['columns'];
  message: string;
  tone?: 'error' | 'muted';
}) {
  return (
    <TableRow>
      <TableCell className={ROW_NUMBER_CLASS} />
      {columns.map((column, index) => (
        <TableCell
          key={column.name}
          className={cn(
            getColumnWidthClass(column.field),
            'max-w-[240px] border-r align-top font-mono text-xs',
            index === 0
              ? tone === 'error'
                ? 'p-4 text-sm text-red-500'
                : 'text-muted-foreground p-4 text-sm'
              : 'p-4',
          )}
        >
          {index === 0 ? message : ''}
        </TableCell>
      ))}
    </TableRow>
  );
}

type DataRowProps = {
  columns: UseMosaicProfilerReturn['columns'];
  pageIndex: number;
  pageSize: number;
  pageTable: NonNullable<UseMosaicProfilerReturn['pageTable']>;
  rowIndex: number;
};

const DataRow = memo(function DataRow({
  columns,
  pageIndex,
  pageSize,
  pageTable,
  rowIndex,
}: DataRowProps) {
  return (
    <TableRow>
      <TableCell className={ROW_NUMBER_CLASS}>
        {pageIndex * pageSize + rowIndex + 1}
      </TableCell>
      {columns.map((column) => {
        const vector = pageTable.getChild(column.name) as arrow.Vector | null;
        const value = vector?.get(rowIndex);
        return (
          <TableCell
            key={column.name}
            className={cn(
              getColumnWidthClass(column.field),
              'max-w-[240px] overflow-hidden border-r align-top font-mono text-xs',
              isNumericArrowType(column.field.type) && 'text-right',
            )}
          >
            <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              <ArrowCellValue
                fieldName={column.name}
                fontSizeClass="text-xs"
                formatValue={formatProfilerValue}
                type={column.field.type}
                value={value}
              />
            </span>
          </TableCell>
        );
      })}
    </TableRow>
  );
});

function MosaicProfilerRowsImpl({
  className,
  profiler,
}: MosaicProfilerRowsProps) {
  if (profiler.tableError) {
    return (
      <TableBody className={className}>
        <SizingRow columns={profiler.columns} />
        <EmptyStateRow
          columns={profiler.columns}
          message={profiler.tableError.message}
          tone="error"
        />
      </TableBody>
    );
  }

  if (!profiler.pageTable || profiler.pageTable.numRows === 0) {
    return (
      <TableBody className={className}>
        <SizingRow columns={profiler.columns} />
        <EmptyStateRow columns={profiler.columns} message="No rows" />
      </TableBody>
    );
  }

  const rows = Array.from(
    {length: profiler.pageTable.numRows},
    (_, index) => index,
  );
  const pageTable = profiler.pageTable;

  return (
    <TableBody className={className}>
      {rows.map((rowIndex) => (
        <DataRow
          key={rowIndex}
          columns={profiler.columns}
          pageIndex={profiler.pagination.pageIndex}
          pageSize={profiler.pagination.pageSize}
          pageTable={pageTable}
          rowIndex={rowIndex}
        />
      ))}
    </TableBody>
  );
}

function areRowColumnsEqual(
  left: UseMosaicProfilerReturn['columns'],
  right: UseMosaicProfilerReturn['columns'],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((column, index) => {
    const other = right[index];
    return (
      column.name === other?.name &&
      column.kind === other.kind &&
      column.field === other.field
    );
  });
}

export const MosaicProfilerRows = memo(
  MosaicProfilerRowsImpl,
  (previous, next) =>
    previous.className === next.className &&
    previous.profiler.pageTable === next.profiler.pageTable &&
    previous.profiler.tableError === next.profiler.tableError &&
    previous.profiler.pagination.pageIndex ===
      next.profiler.pagination.pageIndex &&
    previous.profiler.pagination.pageSize ===
      next.profiler.pagination.pageSize &&
    areRowColumnsEqual(previous.profiler.columns, next.profiler.columns),
);
