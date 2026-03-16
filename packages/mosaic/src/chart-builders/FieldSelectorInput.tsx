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
import {ChartBuilderColumn, MosaicChartBuilderField} from './types';

export interface FieldSelectorInputProps {
  field: MosaicChartBuilderField;
  columns: ChartBuilderColumn[];
  value: string | undefined;
  onChange: (value: string) => void;
}

/**
 * A searchable dropdown selector for choosing a table column for a chart builder field.
 */
export const FieldSelectorInput: React.FC<FieldSelectorInputProps> = ({
  field,
  columns,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);

  const filteredColumns = field.types
    ? columns.filter((col) =>
        field.types!.some((t) =>
          col.type.toUpperCase().includes(t.toUpperCase()),
        ),
      )
    : columns;

  const selectedColumn = filteredColumns.find((col) => col.name === value);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selectedColumn ? (
              <span className="flex items-center gap-2 truncate">
                <span className="truncate">{selectedColumn.name}</span>
                <span className="text-muted-foreground text-xs">
                  {selectedColumn.type}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Select {field.label.toLowerCase()}...
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder={`Search columns...`} />
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
                        'mr-2 h-4 w-4 shrink-0',
                        value === col.name ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{col.name}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
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
