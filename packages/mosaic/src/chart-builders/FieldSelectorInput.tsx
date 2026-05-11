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
import {ChartBuilderColumn, ChartBuilderField} from '../chart-types/base-types';

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
  const [open, setOpen] = useState(false);

  const filteredColumns = field.types
    ? columns.filter((col) =>
        field.types!.some((t) => col.type.toUpperCase() === t.toUpperCase()),
      )
    : columns;

  const selectedColumn = filteredColumns.find((col) => col.name === value);

  return (
    <div className="@container flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 w-full justify-between text-xs font-normal"
          >
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
                    <span className="truncate text-xs">{col.name}</span>
                    <span className="text-muted-foreground ml-auto text-[8px]">
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
