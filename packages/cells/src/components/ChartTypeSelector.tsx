import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {ChartColumnBig, ChartLine} from 'lucide-react';

const chartTypeOptions = [
  {value: 'bar', label: 'Bar', icon: ChartColumnBig},
  {value: 'line', label: 'Line', icon: ChartLine},
] as const;

interface ChartTypeSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
}

export const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({
  value,
  onValueChange,
}) => {
  const selectedChartType =
    chartTypeOptions.find((opt) => opt.value === value) ?? chartTypeOptions[0];

  const IconComponent = selectedChartType.icon;

  return (
    <Select value={selectedChartType.value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select chart type">
          <div className="flex items-center gap-2">
            <IconComponent className="h-4 w-4" />
            <span>{selectedChartType.label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {chartTypeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              <option.icon className="h-4 w-4" />
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
