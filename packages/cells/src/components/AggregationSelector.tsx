import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';

const aggregationOptions = [
  {value: 'sum', label: 'Sum'},
  {value: 'mean', label: 'Mean'},
  {value: 'count', label: 'Count'},
] as const;

interface AggregationSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
}

export const AggregationSelector: React.FC<AggregationSelectorProps> = ({
  value,
  onValueChange,
}) => {
  const selectedAggregation =
    aggregationOptions.find((opt) => opt.value === value) ??
    aggregationOptions[0];

  return (
    <Select value={selectedAggregation.value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {aggregationOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
