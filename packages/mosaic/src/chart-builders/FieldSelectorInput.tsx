import {
  Button,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sqlrooms/ui';
import {Check, ChevronsUpDown} from 'lucide-react';
import React, {useState} from 'react';
import {ChartBuilderColumn, ChartBuilderField} from './types';

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
  placeholder,
}) => {
  const [open, setOpen] = useState(false);

  const filteredColumns = field.types
    ? columns.filter((col) =>
        field.types!.some((t) => col.type.toUpperCase() === t.toUpperCase()),
      )
    : columns;

  const selectedColumn = filteredColumns.find((col) => col.name === value);

  const showLabel = field.label && field.label.trim() !== '';
  const placeholderText =
    placeholder || `Select ${field.label.toLowerCase()}...`;

  return (
    <div className="flex flex-col gap-1">
      {showLabel && (
        <label className="text-xs font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 w-full justify-between text-xs font-normal"
          >
            {selectedColumn ? (
              <span className="flex items-center gap-2 truncate">
                <span className="truncate">{selectedColumn.name}</span>
                <span className="text-muted-foreground text-[10px]">
                  {selectedColumn.type}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholderText}</span>
            )}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 text-xs">
          <Command>
            <CommandInput
              placeholder={`Search columns...`}
              className="text-xs"
            />
            <CommandList>
              <CommandEmpty>No matching column.</CommandEmpty>
              <CommandGroup>
                {filteredColumns.map((col) => (
                  <CommandItem
                    key={col.name}
                    value={col.name}
                    onSelect={(currentValue) => {
                      onChange(currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-3.5 w-3.5 shrink-0',
                        value === col.name ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{col.name}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">
                      {col.type}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
