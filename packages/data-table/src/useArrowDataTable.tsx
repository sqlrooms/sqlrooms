import {resolveFontSizeClass} from '@sqlrooms/ui';
import {shorten} from '@sqlrooms/utils';
import {createColumnHelper} from '@tanstack/react-table';
import {ColumnDef} from '@tanstack/table-core';
import * as arrow from 'apache-arrow';
import {useMemo} from 'react';
import {
  ArrowCellValue,
  type ArrowCellValueFormatter,
  MAX_VALUE_LENGTH,
  isNumericArrowType,
} from './ArrowCellValue';

const columnHelper = createColumnHelper();

// TODO: support fetch the result chunks lazily https://github.com/duckdb/duckdb-wasm/tree/master/packages/duckdb-wasm#query-execution

type UseArrowDataTableResult = {
  data: ArrayLike<any>;
  columns: ColumnDef<any, any>[];
};

export type ArrowColumnMeta = {
  type: arrow.DataType;
  isNumeric: boolean;
};

/**
 * Formatter for rendering Arrow cell values in data tables.
 * Return a string to override the default formatting.
 * If you don't return anything (or return undefined), the default formatter is used.
 *
 * @param type - The Arrow DataType for the column
 * @param value - The raw cell value
 * @returns A formatted string, or undefined/nothing to fall back to the default
 *
 * @example
 * ```ts
 * formatValue: (type, value) => {
 *   if (arrow.DataType.isDecimal(type)) {
 *     return `$${value}`;
 *   }
 *   if (arrow.DataType.isBinary(type) && value instanceof Uint8Array) {
 *     return `${value.byteLength} bytes`;
 *   }
 * }
 * ```
 */
export type ArrowDataTableValueFormatter = ArrowCellValueFormatter;

export type UseArrowDataTableOptions = {
  /** Custom font size for the table e.g. xs, sm, md, lg, base */
  fontSize?: string;
  /**
   * Custom value formatter that overrides the default valueToString.
   * Return a string to use your custom formatting, or undefined to fall back to the default.
   */
  formatValue?: ArrowDataTableValueFormatter;
};

// Only use for small tables or in combination with pagination
export default function useArrowDataTable(
  table: arrow.Table | undefined,
  options: UseArrowDataTableOptions = {},
): UseArrowDataTableResult | undefined {
  const {fontSize = 'base', formatValue} = options;
  const fontSizeClass = resolveFontSizeClass(fontSize);
  const data = useMemo(() => ({length: table?.numRows ?? 0}), [table]);
  const columns = useMemo(() => {
    if (!table) return undefined;
    const columns: ColumnDef<any, any>[] = [];
    for (const field of table.schema.fields) {
      columns.push(
        columnHelper.accessor((_row, i) => table.getChild(field.name)?.get(i), {
          cell: (info) => {
            const value = info.getValue();
            return (
              <ArrowCellValue
                fieldName={field.name}
                fontSizeClass={fontSizeClass}
                formatValue={formatValue}
                type={field.type}
                value={value}
              />
            );
          },
          header: shorten(field.name, MAX_VALUE_LENGTH),
          meta: {
            type: field.type,
            isNumeric: isNumericArrowType(field.type),
          },
        }),
      );
    }
    return columns;
  }, [table, fontSizeClass, formatValue]);

  return data && columns ? {data, columns} : undefined;
}
