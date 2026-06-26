import {type FC} from 'react';
import {MosaicChartSettings} from './chart-settings/MosaicChartSettings';
import {type ChartConfig} from './chart-types/chart-config';
import {DataTable} from '@sqlrooms/db';

export type MosaicChartSettingsPanelProps = {
  dataTable?: DataTable;
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
};

export const MosaicChartSettingsPanel: FC<MosaicChartSettingsPanelProps> = ({
  dataTable,
  config,
  onChange,
}) => {
  const columns = dataTable?.columns || [];

  return (
    <MosaicChartSettings.Root
      config={config}
      columns={columns}
      onChange={onChange}
    >
      <MosaicChartSettings.TypeSelector />
      <MosaicChartSettings.Fields />
    </MosaicChartSettings.Root>
  );
};
