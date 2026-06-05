import React from 'react';
import {
  ChartBuilderColumn,
  ChartBuilderField,
} from '../charts/chart-types/base-types';
import {Combobox} from './Combobox';

export interface FieldSelectorInputProps {
  field: ChartBuilderField;
  columns: ChartBuilderColumn[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * A searchable dropdown selector for choosing a table column for a chart builder field.
 */
export const FieldSelectorInput: React.FC<FieldSelectorInputProps> = ({
  field,
  columns,
  value,
  onChange,
  placeholder = 'Select...',
}) => {
  const filteredColumns = field.types
    ? columns.filter((col) =>
        field.types!.some((t) => col.type.toUpperCase() === t.toUpperCase()),
      )
    : columns;

  const selectedColumn = filteredColumns.find((col) => col.name === value);

  return (
    <div className="@container flex flex-col gap-1">
      <Combobox value={value ?? ''} onChange={onChange}>
        <Combobox.Trigger className="w-full">
          {selectedColumn ? (
            <span className="flex min-w-0 items-baseline gap-1">
              <span className="truncate text-xs">{selectedColumn.name}</span>
              <span className="text-muted-foreground hidden overflow-hidden text-[8px] whitespace-nowrap @[180px]:inline">
                {selectedColumn.type}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground truncate text-xs">
              {placeholder}
            </span>
          )}
        </Combobox.Trigger>
        <Combobox.Content
          searchable
          searchPlaceholder="Search columns..."
          emptyMessage="No matching column."
        >
          {filteredColumns.map((col) => (
            <Combobox.Item key={col.name} value={col.name}>
              <span className="truncate text-xs">{col.name}</span>
              <span className="text-muted-foreground ml-auto text-[8px]">
                {col.type}
              </span>
            </Combobox.Item>
          ))}
        </Combobox.Content>
      </Combobox>
    </div>
  );
};
