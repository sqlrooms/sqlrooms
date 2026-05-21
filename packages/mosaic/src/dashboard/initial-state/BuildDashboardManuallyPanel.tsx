import {Button} from '@sqlrooms/ui';
import {useCallback, useState} from 'react';
import {TableSelector} from '../../chart-builders/TableSelector';
import {Field} from '../../chart-builders/Field';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {
  useStoreWithMosaicDashboard,
  createMosaicDashboardProfilerPanelConfig,
} from '../MosaicDashboardSlice';

export interface BuildDashboardManuallyPanelProps {
  isStarting: boolean;
  onStartingChange: (isStarting: boolean) => void;
}

export const BuildDashboardManuallyPanel: React.FC<
  BuildDashboardManuallyPanelProps
> = ({isStarting, onStartingChange}) => {
  const {dashboardId} = useMosaicDashboardContext();
  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );
  const addPanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.addPanel,
  );
  const tables = useStoreWithMosaicDashboard((state) => state.db.tables);

  const [tableName, setTableName] = useState<string | undefined>(undefined);

  const handleStart = useCallback(() => {
    if (!tableName) return;

    onStartingChange(true);
    try {
      // Set the selected table
      setSelectedTable(dashboardId, tableName);

      // Find the table info to get the proper title
      const tableInfo = tables.find((t) => t.table.table === tableName);
      const title = tableInfo
        ? `${tableInfo.table.table} profiler`
        : `${tableName} profiler`;

      // Create and add a profiler panel
      const profilerPanel = createMosaicDashboardProfilerPanelConfig({
        title,
      });
      addPanel(dashboardId, profilerPanel);
    } finally {
      onStartingChange(false);
    }
  }, [
    tableName,
    dashboardId,
    setSelectedTable,
    addPanel,
    tables,
    onStartingChange,
  ]);

  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-6">
      <div>
        <h3 className="mb-1 font-medium">Create Manually</h3>
        <p className="text-muted-foreground text-sm">
          Start with a data profiler and build your dashboard step by step
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <Field label="Table" required>
          <TableSelector
            value={tableName}
            onChange={setTableName}
            placeholder="Select table…"
          />
        </Field>
        <div className="text-muted-foreground flex-1 space-y-2 text-sm">
          <p>This will create a dashboard with:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Data profiler for exploring your table</li>
            <li>Quick stats and column information</li>
            <li>Ability to add charts and visualizations</li>
          </ul>
        </div>
        <Button
          className="mt-auto w-full"
          variant="outline"
          disabled={!tableName || isStarting}
          onClick={handleStart}
        >
          {isStarting ? 'Starting...' : 'Create Dashboard'}
        </Button>
      </div>
    </div>
  );
};
