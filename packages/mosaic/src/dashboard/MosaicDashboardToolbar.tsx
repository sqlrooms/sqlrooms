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
import {Check, ChevronsUpDown, Plus} from 'lucide-react';
import React, {useMemo, useState} from 'react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';

export const MosaicDashboardToolbar: React.FC = () => {
  const {dashboardId, canCreateChart, openBuilder} =
    useMosaicDashboardContext();
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);
  const tablesWithColumns = useMemo(
    () => tables.filter((table) => table.columns && table.columns.length > 0),
    [tables],
  );
  const [tablePickerOpen, setTablePickerOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b px-3 py-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">
          {dashboard?.title || 'Dashboard'}
        </h3>
        <Popover open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={tablePickerOpen}
              className="w-[200px] justify-between"
            >
              <span className="truncate">
                {dashboard?.selectedTable || 'Select table…'}
              </span>
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search tables…" />
              <CommandList>
                <CommandEmpty>No tables found.</CommandEmpty>
                <CommandGroup>
                  {tablesWithColumns.map((table) => (
                    <CommandItem
                      key={table.tableName}
                      value={table.tableName}
                      onSelect={(value) => {
                        setSelectedTable(dashboardId, value);
                        setTablePickerOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-3.5 w-3.5 ${dashboard?.selectedTable === table.tableName ? 'opacity-100' : 'opacity-0'}`}
                      />
                      {table.tableName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={openBuilder}
        disabled={!canCreateChart}
      >
        <Plus className="mr-1 h-4 w-4" />
        Add Chart
      </Button>
    </div>
  );
};
