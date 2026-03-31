import React, {useMemo} from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import type {BrushFieldType} from '../types';

const aggregationOptions = [
  {value: 'sum', label: 'Sum'},
  {value: 'mean', label: 'Mean'},
  {value: 'count', label: 'Count'},
] as const;

interface AggregationSelectorProps {
  value?: string;
  fieldType?: BrushFieldType;
  onValueChange: (value: string) => void;
}

export const AggregationSelector: React.FC<AggregationSelectorProps> = ({
  value,
  fieldType,
  onValueChange,
}) => {
  const availableOptions = useMemo(() => {
    return fieldType === 'numeric'
      ? aggregationOptions
      : aggregationOptions.filter((opt) => opt.value === 'count');
  }, [fieldType]);

  const selectedAggregation = useMemo(() => {
    return (
      availableOptions.find((opt) => opt.value === value) ?? availableOptions[0]
    );
  }, [availableOptions, value]);

  return (
    <Select value={selectedAggregation.value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {availableOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
