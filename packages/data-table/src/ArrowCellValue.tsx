import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
import {safeJsonParse, shorten, toDecimalString} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {ClipboardIcon} from 'lucide-react';

export const MAX_VALUE_LENGTH = 64;

export function isNumericArrowType(type: arrow.DataType): boolean {
  return (
    arrow.DataType.isFloat(type) ||
    arrow.DataType.isDecimal(type) ||
    arrow.DataType.isInt(type)
  );
}

/**
 * Converts an Arrow value into a human-readable string.
 */
export function valueToString(type: arrow.DataType, value: unknown): string {
  if (value === null || value === undefined) return 'NULL';

  if (arrow.DataType.isDecimal(type)) {
    const scale = (type as any).scale ?? 0;

    if (value instanceof Uint32Array) {
      return toDecimalString(value, scale);
    }

    return String(value);
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
    if (value instanceof Date) return value.toISOString().slice(0, 10);

    if (typeof value === 'number' || typeof value === 'bigint') {
      const num = Number(value);
      if (!Number.isFinite(num)) return String(num);

      const d = new Date(num);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

      return String(num);
    }

    if (typeof value === 'string') {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }

    return String(value);
  }

  return String(value);
}

export type ArrowCellValueFormatter = (
  type: arrow.DataType,
  value: unknown,
) => string | undefined;

export type ArrowCellValueProps = {
  fieldName: string;
  fontSizeClass?: string;
  formatValue?: ArrowCellValueFormatter;
  type: arrow.DataType;
  value: unknown;
};

export function ArrowCellValue({
  fieldName,
  fontSizeClass = 'text-base',
  formatValue,
  type,
  value,
}: ArrowCellValueProps) {
  const valueStr = formatValue?.(type, value) ?? valueToString(type, value);
  const parsedJson = safeJsonParse<unknown>(valueStr);
  const isJsonValue = parsedJson !== undefined;

  if (valueStr.length <= MAX_VALUE_LENGTH) {
    return <>{valueStr}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span className="cursor-pointer">
          {shorten(`${valueStr}`, MAX_VALUE_LENGTH)}
        </span>
      </PopoverTrigger>

      <PopoverContent
        sideOffset={4}
        align="center"
        className={`w-[400px] max-w-[90vw] rounded-md p-4 shadow-md ${fontSizeClass}`}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 font-medium" title={fieldName}>
              {shorten(fieldName, MAX_VALUE_LENGTH)}
            </span>
            <span className="text-muted-foreground shrink-0">{`(${type})`}</span>
          </div>

          <div className="max-h-[300px] min-h-[100px] overflow-auto">
            {isJsonValue && parsedJson ? (
              <JsonCodeMirrorEditor
                value={parsedJson}
                readOnly={true}
                options={{
                  lineNumbers: false,
                  lineWrapping: true,
                }}
              />
            ) : (
              <div className="font-mono text-xs wrap-break-word whitespace-pre-wrap">
                {valueStr}
              </div>
            )}
          </div>

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
  );
}
