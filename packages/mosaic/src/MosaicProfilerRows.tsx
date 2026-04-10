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

const COLUMN_WIDTH_CLASS = 'min-w-[170px]';

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

export function MosaicProfilerRows({
  className,
  profiler,
}: MosaicProfilerRowsProps) {
  if (profiler.tableError) {
    return (
      <TableBody className={className}>
        <TableRow>
          <TableCell
            colSpan={profiler.columns.length + 1}
            className="p-4 text-sm text-red-500"
          >
            {profiler.tableError.message}
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  if (!profiler.pageTable || profiler.pageTable.numRows === 0) {
    return (
      <TableBody className={className}>
        <TableRow>
          <TableCell
            colSpan={profiler.columns.length + 1}
            className="text-muted-foreground p-4 text-sm"
          >
            No rows
          </TableCell>
        </TableRow>
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
          <TableCell className="bg-background text-muted-foreground sticky left-0 z-10 min-w-[48px] border-r text-center">
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
                  'max-w-[320px] truncate border-r align-top font-mono text-xs',
                  isNumericArrowType(column.field.type) && 'text-right',
                )}
              >
                <ArrowCellValue
                  fieldName={column.name}
                  fontSizeClass="text-xs"
                  formatValue={formatProfilerValue}
                  type={column.field.type}
                  value={value}
                />
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </TableBody>
  );
}
