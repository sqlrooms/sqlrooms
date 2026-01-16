import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
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
    <Select
      value={value.toString()}
      onValueChange={(v) => onChange(parseInt(v))}
    >
      <SelectTrigger className={cn('h-6 w-fit', className)}>
        <div className="text-xs text-gray-500">
          {`Limit results to ${formatCount(value)} rows`}
        </div>
      </SelectTrigger>
      <SelectContent>
        {limitOptions.map((limit) => (
          <SelectItem key={limit} value={limit.toString()}>
            {`${formatCount(limit)} rows`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
