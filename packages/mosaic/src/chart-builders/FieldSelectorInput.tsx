import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import React from 'react';
import {ChartBuilderColumn, MosaicChartBuilderField} from './types';

export interface FieldSelectorInputProps {
  field: MosaicChartBuilderField;
  columns: ChartBuilderColumn[];
  value: string | undefined;
  onChange: (value: string) => void;
}

/**
 * A dropdown selector for choosing a table column for a chart builder field.
 */
export const FieldSelectorInput: React.FC<FieldSelectorInputProps> = ({
  field,
  columns,
  value,
  onChange,
}) => {
  // Filter columns by type if types are specified
  const filteredColumns = field.types
    ? columns.filter((col) =>
        field.types!.some((t) =>
          col.type.toUpperCase().includes(t.toUpperCase()),
        ),
      )
    : columns;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          {filteredColumns.map((col) => (
            <SelectItem key={col.name} value={col.name}>
              <span>{col.name}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {col.type}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
