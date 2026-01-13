import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
import {ClipboardIcon} from 'lucide-react';
import {safeJsonParse, shorten} from '@sqlrooms/utils';
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

function valueToString(type: arrow.DataType, value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (arrow.DataType.isTimestamp(type)) {
    switch (typeof value) {
      case 'number':
      case 'bigint':
        return new Date(Number(value)).toISOString();
      case 'string':
        return new Date(value).toISOString();
    }
  }
  if (arrow.DataType.isTime(type)) {
    switch (typeof value) {
      case 'number':
      case 'bigint':
        return new Date(Number(value) / 1000).toISOString().substring(11, 19);
      case 'string':
        return new Date(value).toISOString().substring(11, 19);
    }
  }
  if (arrow.DataType.isDate(type)) {
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Fix: Arrow JS may report DATE as Date32 (days) but still return milliseconds
    // (e.g. 1688083200000 = 2023-06-30).
    // Heuristicly check for if the value is too large to be days, treat it as milliseconds.
    if (typeof value === 'number' || typeof value === 'bigint') {
      const raw = Number(value);
      if (!Number.isFinite(raw)) return String(value);

      let ms: number;

      // if value is too large to be days, it's already ms
      if (Math.abs(raw) > 100_000) {
        // already milliseconds
        ms = raw;
      } else {
        // convert days as milliseconds
        ms = raw * 24 * 60 * 60 * 1000;
      }

      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return String(value);

      return d.toISOString().slice(0, 10);
    }

    if (typeof value === 'string') {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
  }

  if (arrow.DataType.isFloat(type)) {
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    return String(value);
  }

  return String(value);
}

// Only use for small tables or in combination with pagination
export default function useArrowDataTable(
  table: arrow.Table | undefined,
  options: {
    /** Custom font size for the table e.g. xs, sm, md, lg, base */
    fontSize?: string;
  } = {},
): UseArrowDataTableResult | undefined {
  const {fontSize = 'base'} = options ?? {};
  const data = useMemo(() => ({length: table?.numRows ?? 0}), [table]);
  const columns = useMemo(() => {
    if (!table) return undefined;
    const columns: ColumnDef<any, any>[] = [];
    for (const field of table.schema.fields) {
      columns.push(
        columnHelper.accessor((_row, i) => table.getChild(field.name)?.get(i), {
          cell: (info) => {
            const value = info.getValue();
            const valueStr = valueToString(field.type, value);
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
                  className={`w-[400px] max-w-[90vw] p-4 ${`text-${fontSize}`} rounded-md shadow-md`}
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
  }, [table, fontSize]);

  return data && columns ? {data, columns} : undefined;
}
