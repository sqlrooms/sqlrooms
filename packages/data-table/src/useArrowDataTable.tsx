import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  resolveFontSizeClass,
} from '@sqlrooms/ui';
import {safeJsonParse, shorten, toDecimalString} from '@sqlrooms/utils';
import {ClipboardIcon} from 'lucide-react';
import {createColumnHelper} from '@tanstack/react-table';
import {ColumnDef} from '@tanstack/table-core';
import * as arrow from 'apache-arrow';
import {useMemo} from 'react';

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

const MAX_VALUE_LENGTH = 64;

/**
 * Converts an Arrow value into a human-readable string.
 */
function valueToString(type: arrow.DataType, value: unknown): string {
  if (value === null || value === undefined) return 'NULL';

  // --- DECIMAL ---
  if (arrow.DataType.isDecimal(type)) {
    const scale = (type as any).scale ?? 0;

    if (value instanceof Uint32Array) {
      // Use Apache Arrow–style helper to convert Decimal128 buffer to string
      return toDecimalString(value, scale);
    }

    // For non-Uint32Array values, fall back to default string rendering.
    return String(value);
  }

  // --- TIMESTAMP ---
  if (arrow.DataType.isTimestamp(type)) {
    switch (typeof value) {
      case 'number':
      case 'bigint':
        return new Date(Number(value)).toISOString();
      case 'string':
        return new Date(value).toISOString();
    }
  }

  // --- TIME ---
  if (arrow.DataType.isTime(type)) {
    switch (typeof value) {
      case 'number':
      case 'bigint':
        return new Date(Number(value) / 1000).toISOString().substring(11, 19);
      case 'string':
        return new Date(value).toISOString().substring(11, 19);
    }
  }

  // --- DATE ---
  // Handle Arrow Date32/Date64 values coming from DuckDB-WASM.
  //
  // 1. If `value` is already a JS Date, format it directly.
  // 2. If store config`castTimestampToDate` is true, DuckDB may return a number or bigint:
  // 3. If `value` is a string, try to parse it as a date.
  //
  // This ensures DATE columns are displayed as "YYYY-MM-DD" regardless of underlying Arrow type.
  if (arrow.DataType.isDate(type)) {
    const dateType = type as arrow.Date_;

    // Already a JS Date
    if (value instanceof Date) return value.toISOString().slice(0, 10);

    if (typeof value === 'number' || typeof value === 'bigint') {
      const num = Number(value);
      if (!Number.isFinite(num)) return String(num);

      const d = new Date(num);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

      return String(num);
    }

    // Fallback for strings
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }

    return String(value);
  }

  // --- fallback ---
  return String(value);
}

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
export type ArrowDataTableValueFormatter = (
  type: arrow.DataType,
  value: unknown,
) => string | undefined;

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
            // Try custom formatter first, fall back to default
            const valueStr =
              formatValue?.(field.type, value) ??
              valueToString(field.type, value);
            const parsedJson = safeJsonParse<unknown>(valueStr);
            const isJsonValue = parsedJson !== undefined;

            return valueStr.length > MAX_VALUE_LENGTH ? (
              <Popover>
                <PopoverTrigger asChild>
                  <span className="cursor-pointer">
                    {shorten(`${valueStr}`, MAX_VALUE_LENGTH)}
                  </span>
                </PopoverTrigger>

                {/* Fixed PopoverContent width */}
                <PopoverContent
                  sideOffset={4}
                  align="center"
                  className={`w-[400px] max-w-[90vw] p-4 ${fontSizeClass} rounded-md shadow-md`}
                >
                  <div className="space-y-2">
                    {/* Header row */}
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="min-w-0 flex-1 font-medium"
                        title={field.name}
                      >
                        {shorten(field.name, MAX_VALUE_LENGTH)}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {`(${field.type})`}
                      </span>
                    </div>

                    {/* Scrollable content - JSON or raw text */}
                    <div className="max-h-[300px] min-h-[100px] overflow-auto">
                      {isJsonValue && parsedJson ? (
                        <JsonMonacoEditor
                          value={parsedJson as any}
                          readOnly={true}
                          options={{
                            lineNumbers: 'off',
                            minimap: {enabled: false},
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                          }}
                        />
                      ) : (
                        <div className="font-mono text-xs break-words whitespace-pre-wrap">
                          {valueStr}
                        </div>
                      )}
                    </div>

                    {/* Copy button */}
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => navigator.clipboard.writeText(valueStr)}
                      >
                        <ClipboardIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              valueStr
            );
          },
          header: shorten(field.name, MAX_VALUE_LENGTH),
          meta: {
            type: field.type,
            isNumeric:
              arrow.DataType.isFloat(field.type) ||
              arrow.DataType.isDecimal(field.type) ||
              arrow.DataType.isInt(field.type),
          },
        }),
      );
    }
    return columns;
  }, [table, fontSizeClass, formatValue]);

  return data && columns ? {data, columns} : undefined;
}
