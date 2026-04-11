import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
import {safeJsonParse, shorten, toDecimalString} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {ClipboardIcon} from 'lucide-react';

export const MAX_VALUE_LENGTH = 64;

function parseArrowTemporalValue(
  type: arrow.DataType,
  value: unknown,
): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'bigint') {
    return undefined;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  if (arrow.DataType.isDate(type)) {
    const unit = (type as arrow.Date_).unit;
    return unit === arrow.DateUnit.DAY
      ? numericValue * 86_400_000
      : numericValue;
  }

  const unit = (type as arrow.Timestamp | arrow.Time).unit;
  switch (unit) {
    case arrow.TimeUnit.SECOND:
      return numericValue * 1000;
    case arrow.TimeUnit.MICROSECOND:
      return numericValue / 1_000;
    case arrow.TimeUnit.NANOSECOND:
      return numericValue / 1_000_000;
    case arrow.TimeUnit.MILLISECOND:
    default:
      return numericValue;
  }
}

function toIsoDateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  return undefined;
}

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
    const isoValue = toIsoDateString(value);
    if (isoValue) {
      return isoValue;
    }

    const milliseconds = parseArrowTemporalValue(type, value);
    if (milliseconds !== undefined) {
      return new Date(milliseconds).toISOString();
    }

    return String(value);
  }

  if (arrow.DataType.isTime(type)) {
    const isoValue = toIsoDateString(value);
    if (isoValue) {
      return isoValue.substring(11, 19);
    }

    const milliseconds = parseArrowTemporalValue(type, value);
    if (milliseconds !== undefined) {
      return new Date(milliseconds).toISOString().substring(11, 19);
    }

    return String(value);
  }

  if (arrow.DataType.isDate(type)) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);

    const isoValue = toIsoDateString(value);
    if (isoValue) {
      return isoValue.slice(0, 10);
    }

    const milliseconds = parseArrowTemporalValue(type, value);
    if (milliseconds !== undefined) {
      const d = new Date(milliseconds);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return String(value);
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
        <button
          type="button"
          className="cursor-pointer text-left"
          aria-label={`Show full value for ${fieldName}`}
        >
          {shorten(`${valueStr}`, MAX_VALUE_LENGTH)}
        </button>
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
            {isJsonValue && parsedJson !== undefined ? (
              <JsonCodeMirrorEditor
                value={parsedJson === null ? 'null' : parsedJson}
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
              aria-label={`Copy value for ${fieldName}`}
              onClick={() => navigator.clipboard.writeText(valueStr)}
            >
              <ClipboardIcon className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
