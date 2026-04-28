import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@sqlrooms/ui';
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  Plus,
  TableProperties,
} from 'lucide-react';
import React, {useEffect, useMemo, useState} from 'react';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {
  type MosaicDashboardAddPanelAction,
  type MosaicDashboardAddPanelActionContext,
  createMosaicDashboardProfilerPanelConfig,
  getMosaicDashboardSelectionName,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

export const MosaicDashboardToolbar: React.FC = () => {
  const {dashboardId, canCreateChart, openBuilder} =
    useMosaicDashboardContext();
  const dashboard = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.config.dashboardsById[dashboardId],
  );
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const addPanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanel,
  );
  const panelRenderers = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.panelRenderers,
  );
  const addPanelActions = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanelActions,
  );
  const getSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.getSelection,
  );
  const dashboardSelectionName = getMosaicDashboardSelectionName(dashboardId);
  const dashboardSelection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.selections[dashboardSelectionName],
  );
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);
  const tablesWithColumns = useMemo(
    () => tables.filter((table) => table.columns && table.columns.length > 0),
    [tables],
  );
  const selectedTable = useMemo(
    () =>
      tablesWithColumns.find(
        (table) => table.tableName === dashboard?.selectedTable,
      ),
    [dashboard?.selectedTable, tablesWithColumns],
  );
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const canAddProfiler = Boolean(
    dashboard?.selectedTable &&
    panelRenderers[MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE],
  );
  const addPanelActionContext = useMemo<MosaicDashboardAddPanelActionContext>(
    () => ({
      dashboardId,
      dashboard,
      selectedTable,
      tables: tablesWithColumns,
    }),
    [dashboard, dashboardId, selectedTable, tablesWithColumns],
  );
  const addPanelActionEntries = useMemo(
    () =>
      addPanelActions.map((action) => ({
        action,
        enabled: action.isEnabled
          ? action.isEnabled(addPanelActionContext)
          : true,
      })),
    [addPanelActionContext, addPanelActions],
  );
  const canAddCustomPanel = addPanelActionEntries.some(
    (entry) => entry.enabled,
  );
  const canAddAnyPanel = canCreateChart || canAddProfiler || canAddCustomPanel;
  const [selectionVersion, setSelectionVersion] = useState(0);

  useEffect(() => {
    if (!dashboardSelection) {
      getSelection(dashboardSelectionName, 'crossfilter');
    }
  }, [dashboardSelection, dashboardSelectionName, getSelection]);

  useEffect(() => {
    if (!dashboardSelection) {
      return;
    }

    const handleSelectionChange = () => {
      setSelectionVersion((value) => value + 1);
    };

    dashboardSelection.addEventListener('value', handleSelectionChange);
    return () => {
      dashboardSelection.removeEventListener('value', handleSelectionChange);
    };
  }, [dashboardSelection]);

  const hasActiveFilters = useMemo(
    () => Boolean(dashboardSelection?.clauses.length),
    [dashboardSelection, selectionVersion],
  );

  const handleAddProfiler = () => {
    const panel = dashboard?.selectedTable
      ? createMosaicDashboardProfilerPanelConfig({
          source: {tableName: dashboard.selectedTable},
        })
      : createMosaicDashboardProfilerPanelConfig();
    addPanel(dashboardId, panel);
  };

  const handleAddCustomPanel = (action: MosaicDashboardAddPanelAction) => {
    const panel = action.createPanel(addPanelActionContext);
    if (panel) {
      addPanel(dashboardId, panel);
    }
  };

  const handleResetFilters = () => {
    dashboardSelection?.reset();
  };

  return (
    <div className="flex items-center justify-between border-b px-3 py-2">
      <div className="flex items-center gap-2">
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
        <Button
          variant="link"
          size="sm"
          className="h-8 px-0"
          disabled={!hasActiveFilters}
          onClick={handleResetFilters}
        >
          Reset filters
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={!canAddAnyPanel}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openBuilder} disabled={!canCreateChart}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Chart
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleAddProfiler}
              disabled={!canAddProfiler}
            >
              <TableProperties className="mr-2 h-4 w-4" />
              Profiler
            </DropdownMenuItem>
            {addPanelActionEntries.map(({action, enabled}) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.type}
                  onClick={() => handleAddCustomPanel(action)}
                  disabled={!enabled}
                >
                  {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                  {action.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
