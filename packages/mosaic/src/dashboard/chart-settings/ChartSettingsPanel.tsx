import {FC} from 'react';
import {ChartSettings} from './ChartSettings';
import {VgPlotChartConfig} from '../../chart-types';
import {useTableColumns} from './useTableColumns';

interface ChartSettingsPanelProps {
  tableName?: string;
  config: VgPlotChartConfig;
  onChange: (settings: VgPlotChartConfig) => void;
  onClose?: () => void;
}

export const ChartSettingsPanel: FC<ChartSettingsPanelProps> = ({
  tableName,
  config,
  onChange,
  onClose,
}) => {
  const columns = useTableColumns(tableName);

  return (
    <ChartSettings.Root
      tableName={tableName}
      config={config}
      columns={columns}
      onChange={onChange}
    >
      <ChartSettings.Header onClose={onClose}>
        Chart settings
      </ChartSettings.Header>
      <ChartSettings.Content>
        <ChartSettings.TypeSelector />
        <ChartSettings.Fields />
      </ChartSettings.Content>
    </ChartSettings.Root>
  );
};
