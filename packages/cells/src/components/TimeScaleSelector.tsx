import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import type {TimeScale} from '../types';

type TimeScaleSelectorOption = {
  value: TimeScale;
  label: string;
};

export const timeScaleOptions = [
  {value: 'none', label: 'None'},
  {value: 'minute', label: 'Minute'},
  {value: 'hour', label: 'Hour'},
  {value: 'day', label: 'Day'},
  {value: 'month', label: 'Month'},
  {value: 'year', label: 'Year'},
] as const satisfies TimeScaleSelectorOption[];

interface TimeScaleSelectorProps {
  value?: TimeScale;
  onValueChange: (value: TimeScale) => void;
}

export const TimeScaleSelector: React.FC<TimeScaleSelectorProps> = ({
  value,
  onValueChange,
}) => {
  const selectedTimeScale =
    timeScaleOptions.find((opt) => opt.value === value) ?? timeScaleOptions[0];

  return (
    <Select value={selectedTimeScale.value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {timeScaleOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
