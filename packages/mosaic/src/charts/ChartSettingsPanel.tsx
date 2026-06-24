import {type DataTable} from '@sqlrooms/db';
import {
  ChartConfig,
  DataTableSelector,
  Field,
  MosaicChartSettingsPanel,
  useTablesWithColumns,
} from '../index';
import {FC} from 'react';

export type ChartSettingsPanelProps = {
  dataTable: DataTable | undefined;
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  onTableChange: (table: DataTable) => void;
};

export const ChartSettingsPanel: FC<ChartSettingsPanelProps> = ({
  dataTable,
  config,
  onConfigChange,
  onTableChange,
}) => {
  const tables = useTablesWithColumns();

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chart Settings</h3>
      </div>

      <Field label="Dataset" required>
        <DataTableSelector
          onChange={onTableChange}
          tables={tables}
          value={dataTable}
          className="w-full"
        />
      </Field>

      <MosaicChartSettingsPanel
        dataTable={dataTable}
        config={config}
        onChange={onConfigChange}
      />
    </div>
  );
};
