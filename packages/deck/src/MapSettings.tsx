import {FC, useMemo} from 'react';
import {
  Field,
  ColumnsProvider,
  useStoreWithMosaicDashboard,
} from '@sqlrooms/mosaic';
import type {MosaicDashboardPanelConfigType} from '@sqlrooms/mosaic';
import {useStoreWithDuckDb} from '@sqlrooms/duckdb';
import {Button} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import {LatitudeSelector} from './LatitudeSelector';
import {LongitudeSelector} from './LongitudeSelector';

interface MapSettingsPanelProps {
  dashboardId: string;
  panel: MosaicDashboardPanelConfigType;
  onClose?: () => void;
}

export const MapSettingsPanel: FC<MapSettingsPanelProps> = ({
  dashboardId,
  panel,
  onClose,
}) => {
  const tables = useStoreWithDuckDb((state) => state.db.tables);
  const tableName = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.selectedTable,
  );
  const currentTable = useMemo(
    () => tables.find((t) => t.table.table === tableName),
    [tables, tableName],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium">
        <div className="flex items-center">Map settings</div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2 p-2">
        {currentTable && (
          <ColumnsProvider columns={currentTable.columns} tableName={tableName}>
            <Field label="Latitude column" required>
              <LatitudeSelector
                dashboardId={dashboardId}
                panel={panel}
                currentTable={currentTable}
              />
            </Field>
            <Field label="Longitude column" required>
              <LongitudeSelector
                dashboardId={dashboardId}
                panel={panel}
                currentTable={currentTable}
              />
            </Field>
          </ColumnsProvider>
        )}
      </div>
    </div>
  );
};
