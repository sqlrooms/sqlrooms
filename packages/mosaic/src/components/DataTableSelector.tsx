import type {DataTable} from '@sqlrooms/db';
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
import {Check, ChevronsUpDown, TableIcon} from 'lucide-react';
import {FC, useMemo, useState} from 'react';

/**
 * Props for table selector components.
 * Both `value` and `onChange` use DataTable objects.
 */
export type DataTableSelectorProps = {
  className?: string;
  disabled?: boolean;
  onChange?: (table: DataTable) => void;
  tables: DataTable[];
  value?: DataTable;
};

type GroupedTables = Array<{
  group: string;
  tables: DataTable[];
}>;

/**
 * Returns the group label for the table (database.schema).
 */
function getTableGroupLabel(table: DataTable): string {
  return [table.table.database, table.table.schema]
    .filter((part): part is string => Boolean(part))
    .join('.');
}

/**
 * Returns searchable values for the table (all name components).
 */
function getTableSearchValue(table: DataTable): string {
  return [
    table.table.toString(),
    table.table.table,
    table.table.schema,
    table.table.database,
  ]
    .filter(Boolean)
    .join(' ');
}

function groupTables(tables: DataTable[]): GroupedTables {
  const groups = new Map<string, DataTable[]>();

  for (const table of tables) {
    const group = getTableGroupLabel(table) || 'Tables';
    groups.set(group, [...(groups.get(group) ?? []), table]);
  }

  return Array.from(groups, ([group, groupTables]) => ({
    group,
    tables: [...groupTables].sort((left, right) =>
      left.table.table.localeCompare(right.table.table),
    ),
  })).sort((left, right) => left.group.localeCompare(right.group));
}

const DataTableSelectorCommand: FC<DataTableSelectorProps> = ({
  onChange,
  tables,
  value,
}) => {
  const groupedTables = useMemo(() => groupTables(tables), [tables]);

  const selectedTableReference = value?.table.toString();

  return (
    <Command>
      <CommandInput placeholder="Search tables..." className="text-xs" />
      <CommandList>
        <CommandEmpty className="text-xs">No tables found.</CommandEmpty>
        {groupedTables.map((group) => (
          <CommandGroup key={group.group} heading={group.group}>
            {group.tables.map((table) => {
              const tableReference = table.table.toString();
              const selectTable = () => onChange?.(table);

              const isSelected = selectedTableReference === tableReference;

              return (
                <CommandItem
                  key={tableReference}
                  value={getTableSearchValue(table)}
                  onClick={selectTable}
                  onSelect={selectTable}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      'mr-2 h-3.5 w-3.5 shrink-0',
                      isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {table.table.table}
                  </span>
                  {table.isView ? (
                    <span className="text-muted-foreground ml-2 text-[10px]">
                      view
                    </span>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
};

/**
 * Searchable table selector grouped by database and schema.
 */
export const DataTableSelector: FC<DataTableSelectorProps> = ({
  className,
  disabled,
  onChange,
  tables,
  value,
}) => {
  const [open, setOpen] = useState(false);

  const selectedTableReference = value?.table.toString();

  const selectedTable = tables.find(
    (table) => selectedTableReference === table.table.toString(),
  );

  const selectedLabel = selectedTable?.table.table ?? value?.table.table;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-8 w-48 max-w-full justify-between text-xs',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <TableIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-mono">
              {selectedLabel || 'Select table...'}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0 text-xs" align="start">
        <DataTableSelectorCommand
          onChange={(tableName) => {
            onChange?.(tableName);
            setOpen(false);
          }}
          tables={tables}
          value={value}
        />
      </PopoverContent>
    </Popover>
  );
};

/**
 * Presentational empty-state wrapper that renders the same searchable selector.
 */
export const DataTableSelectorEmptyState: FC<DataTableSelectorProps> = (
  props,
) => {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="bg-popover text-popover-foreground w-full max-w-md rounded-md border shadow-sm">
        <DataTableSelectorCommand {...props} />
      </div>
    </div>
  );
};
