import {FC} from 'react';
import {ChartSettings} from './ChartSettings';
import {VgPlotChartConfig} from '../../chart-types';
import {useTableColumns} from './useTableColumns';

interface ChartSettingsPanelProps {
  tableName?: string;
  config: VgPlotChartConfig;
  onChange: (settings: VgPlotChartConfig) => void;
}

export const ChartSettingsPanel: FC<ChartSettingsPanelProps> = ({
  tableName,
  config,
  onChange,
}) => {
  const columns = useTableColumns(tableName);

  return (
    <ChartSettings.Root
      tableName={tableName}
      config={config}
      columns={columns}
      onChange={onChange}
    >
      <ChartSettings.TypeSelector />
      <ChartSettings.Fields />
    </ChartSettings.Root>
  );
};
