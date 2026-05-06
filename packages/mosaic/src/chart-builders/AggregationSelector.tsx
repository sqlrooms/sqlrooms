import type {FC} from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import type {AggregateFunction} from '../chart-types/line-chart/schema';

export interface AggregationSelectorProps {
  value: AggregateFunction;
  onChange: (value: AggregateFunction) => void;
}

/**
 * Dropdown for selecting an aggregation function (SUM, AVG, MIN, MAX).
 */
export const AggregationSelector: FC<AggregationSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[100px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sum" className="text-xs">
          SUM
        </SelectItem>
        <SelectItem value="avg" className="text-xs">
          AVG
        </SelectItem>
        <SelectItem value="min" className="text-xs">
          MIN
        </SelectItem>
        <SelectItem value="max" className="text-xs">
          MAX
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
