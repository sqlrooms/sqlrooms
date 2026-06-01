import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import {ChevronDown} from 'lucide-react';
import React, {useMemo} from 'react';

export interface QueryResultLimitSelectProps {
  /**
   * Current limit value
   */
  value: number;
  /**
   * Callback when limit changes
   */
  onChange: (limit: number) => void;
  /**
   * Available limit options
   * @default [100, 500, 1000, 5000, 10000]
   */
  options?: number[];
  /**
   * Custom class name
   */
  className?: string;
}

/**
 * Reusable dropdown for selecting query result limits.
 * Used in QueryResultPanel and SqlQueryPreview.
 */
export const QueryResultLimitSelect: React.FC<QueryResultLimitSelectProps> = ({
  value,
  onChange,
  options = [100, 500, 1000, 5000, 10000],
  className,
}) => {
  // Ensure current value is in options list
  const limitOptions = useMemo(() => {
    if (!options.includes(value)) {
      return [value, ...options].sort((a, b) => a - b);
    }
    return options;
  }, [options, value]);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'border-input bg-background flex h-6 w-fit items-center justify-between gap-1 rounded-md border px-2 py-1 shadow-sm outline-hidden focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className="text-xs text-gray-500">
            {`Limit results to ${formatCount(value)} rows`}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value.toString()}
          onValueChange={(v) => onChange(parseInt(v, 10))}
        >
          {limitOptions.map((limit) => (
            <DropdownMenuRadioItem key={limit} value={limit.toString()}>
              {`${formatCount(limit)} rows`}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
