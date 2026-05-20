import {type FC, useState} from 'react';
import {
  Button,
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
import {useTablesWithColumns} from '../dashboard/useTablesWithColumns';

export interface TableSelectorProps {
  value: string | undefined;
  onChange?: (tableName: string) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Table selector component for choosing a table from available tables.
 * Uses a searchable dropdown with command palette pattern.
 *
 * Filters to only show tables that have columns defined.
 */
export const TableSelector: FC<TableSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select table…',
}) => {
  const [open, setOpen] = useState(false);
  const tables = useTablesWithColumns();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-xs"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 text-xs" align="start">
        <Command>
          <CommandInput placeholder="Search tables…" className="text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs">No tables found.</CommandEmpty>
            <CommandGroup>
              {tables.map((table) => {
                const tableName = table.table.table;
                return (
                  <CommandItem
                    key={tableName}
                    value={tableName}
                    onSelect={(selectedValue) => {
                      onChange?.(selectedValue);
                      setOpen(false);
                    }}
                    className="text-xs"
                  >
                    <Check
                      className={`mr-2 h-3.5 w-3.5 ${value === tableName ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {tableName}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
