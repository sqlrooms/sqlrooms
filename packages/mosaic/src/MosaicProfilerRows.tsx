import {ArrowCellValue, isNumericArrowType} from '@sqlrooms/data-table';
import {cn, TableBody, TableCell, TableRow} from '@sqlrooms/ui';
import * as arrow from 'apache-arrow';
import type {UseMosaicProfilerReturn} from './profiler/types';
import {isProfilerUnsupportedSummaryType} from './profiler/utils';

export type MosaicProfilerRowsProps = {
  className?: string;
  profiler: Pick<
    UseMosaicProfilerReturn,
    'columns' | 'pageTable' | 'pagination' | 'tableError'
  >;
};

const COLUMN_WIDTH_CLASS = 'min-w-[170px] w-[170px] max-w-[170px]';

function getColumnWidthClass(field: arrow.Field) {
  return isProfilerUnsupportedSummaryType(field.type)
    ? 'min-w-[120px] w-[120px] max-w-[120px]'
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
      <TableCell className="w-[48px] max-w-[48px] min-w-[48px] border-r p-0" />
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
      <TableCell className="bg-background text-muted-foreground sticky left-0 z-10 w-[48px] max-w-[48px] min-w-[48px] border-r text-center" />
      {columns.map((column, index) => (
        <TableCell
          key={column.name}
          className={cn(
            getColumnWidthClass(column.field),
            'max-w-[320px] border-r align-top font-mono text-xs',
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

export function MosaicProfilerRows({
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

  return (
    <TableBody className={className}>
      {rows.map((rowIndex) => (
        <TableRow key={rowIndex}>
          <TableCell className="bg-background text-muted-foreground sticky left-0 z-10 w-[48px] max-w-[48px] min-w-[48px] border-r text-center">
            {profiler.pagination.pageIndex * profiler.pagination.pageSize +
              rowIndex +
              1}
          </TableCell>
          {profiler.columns.map((column) => {
            const vector = profiler.pageTable!.getChild(
              column.name,
            ) as arrow.Vector | null;
            const value = vector?.get(rowIndex);
            return (
              <TableCell
                key={column.name}
                className={cn(
                  getColumnWidthClass(column.field),
                  'max-w-[320px] overflow-hidden border-r align-top font-mono text-xs',
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
      ))}
    </TableBody>
  );
}
