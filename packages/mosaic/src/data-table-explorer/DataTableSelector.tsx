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
import {useMemo, useState} from 'react';

/**
 * Props for table selector components. `value` and `onChange` use the dotted
 * table reference format `database.schema.table`.
 */
export type DataTableSelectorProps = {
  className?: string;
  disabled?: boolean;
  onChange?: (tableName: string) => void;
  tables: DataTable[];
  value?: string;
};

type GroupedTables = Array<{
  group: string;
  tables: DataTable[];
}>;

function getTableReference(table: DataTable): string {
  return [table.table.database, table.table.schema, table.table.table]
    .filter((part): part is string => Boolean(part))
    .join('.');
}

function getTableGroupLabel(table: DataTable): string {
  return [table.table.database, table.table.schema]
    .filter((part): part is string => Boolean(part))
    .join('.');
}

function getTableSearchValue(table: DataTable): string {
  return [
    getTableReference(table),
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

function DataTableSelectorCommand({
  onChange,
  tables,
  value,
}: DataTableSelectorProps) {
  const groupedTables = useMemo(() => groupTables(tables), [tables]);

  return (
    <Command>
      <CommandInput placeholder="Search tables..." className="text-xs" />
      <CommandList>
        <CommandEmpty className="text-xs">No tables found.</CommandEmpty>
        {groupedTables.map((group) => (
          <CommandGroup key={group.group} heading={group.group}>
            {group.tables.map((table) => {
              const tableReference = getTableReference(table);
              const selectTable = () => onChange?.(tableReference);
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
                      value === tableReference ? 'opacity-100' : 'opacity-0',
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
}

/**
 * Searchable table selector grouped by database and schema.
 */
export function DataTableSelector({
  className,
  disabled,
  onChange,
  tables,
  value,
}: DataTableSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedTable = tables.find((table) => getTableReference(table) === value);
  const selectedLabel = selectedTable?.table.table ?? value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-8 w-48 max-w-full justify-between text-xs', className)}
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
}

/**
 * Presentational empty-state wrapper that renders the same searchable selector.
 */
export function DataTableSelectorEmptyState(props: DataTableSelectorProps) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="bg-popover text-popover-foreground w-full max-w-md rounded-md border shadow-sm">
        <DataTableSelectorCommand {...props} />
      </div>
    </div>
  );
}

/**
 * Returns the dotted table reference used by DataTableSelector values.
 */
export function getDataTableSelectorReference(table: DataTable): string {
  return getTableReference(table);
}
