import {ArrowCellValue, isNumericArrowType} from '@sqlrooms/data-table';
import {cn, TableBody, TableCell, TableRow} from '@sqlrooms/ui';
import * as arrow from 'apache-arrow';
import {memo} from 'react';
import {
  DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_STYLE,
  DATA_TABLE_EXPLORER_ROW_NUMBER_WIDTH_STYLE,
  DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_STYLE,
} from './layout';
import type {UseDataTableExplorerReturn} from './types';
import {isDataTableExplorerUnsupportedSummaryType} from './utils';

export type DataTableExplorerRowsProps = {
  className?: string;
  explorer: Pick<
    UseDataTableExplorerReturn,
    'columns' | 'pageTable' | 'pagination' | 'tableError'
  >;
};

const ROW_NUMBER_CLASS =
  'bg-background text-muted-foreground sticky left-0 z-10 border-r px-1 text-center';

function getColumnWidthStyle(field: arrow.Field) {
  return isDataTableExplorerUnsupportedSummaryType(field.type)
    ? DATA_TABLE_EXPLORER_UNSUPPORTED_COLUMN_WIDTH_STYLE
    : DATA_TABLE_EXPLORER_DEFAULT_COLUMN_WIDTH_STYLE;
}

function formatDataTableExplorerValue(type: arrow.DataType, value: unknown) {
  if (arrow.DataType.isBinary(type) && value instanceof Uint8Array) {
    return `${value.byteLength} bytes`;
  }
  return undefined;
}

function SizingRow({
  columns,
}: {
  columns: UseDataTableExplorerReturn['columns'];
}) {
  return (
    <TableRow
      aria-hidden="true"
      className="pointer-events-none h-0 border-0 opacity-0 hover:bg-transparent"
    >
      <TableCell
        className="border-r p-0"
        style={DATA_TABLE_EXPLORER_ROW_NUMBER_WIDTH_STYLE}
      />
      {columns.map((column) => (
        <TableCell
          key={column.name}
          className="border-r p-0"
          style={getColumnWidthStyle(column.field)}
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
  columns: UseDataTableExplorerReturn['columns'];
  message: string;
  tone?: 'error' | 'muted';
}) {
  return (
    <TableRow>
      <TableCell
        className={ROW_NUMBER_CLASS}
        style={DATA_TABLE_EXPLORER_ROW_NUMBER_WIDTH_STYLE}
      />
      <TableCell
        colSpan={Math.max(columns.length, 1)}
        className={cn(
          'max-w-[240px] border-r p-4 align-top font-mono text-xs',
          tone === 'error'
            ? 'text-sm text-red-500'
            : 'text-muted-foreground text-sm',
        )}
      >
        {message}
      </TableCell>
    </TableRow>
  );
}

type DataRowProps = {
  columns: UseDataTableExplorerReturn['columns'];
  pageIndex: number;
  pageSize: number;
  pageTable: NonNullable<UseDataTableExplorerReturn['pageTable']>;
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
      <TableCell
        className={ROW_NUMBER_CLASS}
        style={DATA_TABLE_EXPLORER_ROW_NUMBER_WIDTH_STYLE}
      >
        {pageIndex * pageSize + rowIndex + 1}
      </TableCell>
      {columns.map((column) => {
        const vector = pageTable.getChild(column.name) as arrow.Vector | null;
        const value = vector?.get(rowIndex);
        return (
          <TableCell
            key={column.name}
            className={cn(
              'max-w-[240px] overflow-hidden border-r align-top font-mono text-xs',
              isNumericArrowType(column.field.type) && 'text-right',
            )}
            style={getColumnWidthStyle(column.field)}
          >
            <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              <ArrowCellValue
                fieldName={column.name}
                fontSizeClass="text-xs"
                formatValue={formatDataTableExplorerValue}
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

function DataTableExplorerRowsImpl({
  className,
  explorer,
}: DataTableExplorerRowsProps) {
  if (explorer.tableError) {
    return (
      <TableBody className={className}>
        <SizingRow columns={explorer.columns} />
        <EmptyStateRow
          columns={explorer.columns}
          message={explorer.tableError.message}
          tone="error"
        />
      </TableBody>
    );
  }

  if (!explorer.pageTable || explorer.pageTable.numRows === 0) {
    return (
      <TableBody className={className}>
        <SizingRow columns={explorer.columns} />
        <EmptyStateRow columns={explorer.columns} message="No rows" />
      </TableBody>
    );
  }

  const rows = Array.from(
    {length: explorer.pageTable.numRows},
    (_, index) => index,
  );
  const pageTable = explorer.pageTable;

  return (
    <TableBody className={className}>
      {rows.map((rowIndex) => (
        <DataRow
          key={rowIndex}
          columns={explorer.columns}
          pageIndex={explorer.pagination.pageIndex}
          pageSize={explorer.pagination.pageSize}
          pageTable={pageTable}
          rowIndex={rowIndex}
        />
      ))}
    </TableBody>
  );
}

function areRowColumnsEqual(
  left: UseDataTableExplorerReturn['columns'],
  right: UseDataTableExplorerReturn['columns'],
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

export const DataTableExplorerRows = memo(
  DataTableExplorerRowsImpl,
  (previous, next) =>
    previous.className === next.className &&
    previous.explorer.pageTable === next.explorer.pageTable &&
    previous.explorer.tableError === next.explorer.tableError &&
    previous.explorer.pagination.pageIndex ===
      next.explorer.pagination.pageIndex &&
    previous.explorer.pagination.pageSize ===
      next.explorer.pagination.pageSize &&
    areRowColumnsEqual(previous.explorer.columns, next.explorer.columns),
);
