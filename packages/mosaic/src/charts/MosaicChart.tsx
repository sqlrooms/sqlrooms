import {type FC, useCallback} from 'react';
import {MosaicDashboardPanelLayout} from '../dashboard/panel/MosaicDashboardPanelLayout';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import type {ChartConfig} from './chart-types/chart-config';
import {MosaicChartView} from './MosaicChartView';
import {DataTable} from '@sqlrooms/db';

export type MosaicChartProps = {
  dataTable?: DataTable;
  selectionName: string;
  config: ChartConfig;
  runtimeKey: string;
  onConfigChange?: (config: ChartConfig) => void;
};

export const MosaicChart: FC<MosaicChartProps> = ({
  dataTable,
  selectionName,
  config,
  runtimeKey,
  onConfigChange,
}) => {
  const handleOpenChange = useCallback(
    (isOpen: boolean) => onConfigChange?.({...config, settingsOpen: isOpen}),
    [config, onConfigChange],
  );

  const handleConfigChange = useCallback(
    (newConfig: ChartConfig) => onConfigChange?.(newConfig),
    [onConfigChange],
  );

  const settingsContent = (
    <MosaicChartSettingsPanel
      dataTable={dataTable}
      config={config}
      onChange={handleConfigChange}
      onClose={() => handleOpenChange(false)}
    />
  );

  const chartContent = (
    <div className="h-full overflow-auto p-2">
      <MosaicChartView
        dataTable={dataTable}
        config={config}
        selectionName={selectionName}
        retentionKey={runtimeKey}
        runtimeIssueKey={runtimeKey}
      />
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <MosaicDashboardPanelLayout
        isOpen={config.settingsOpen}
        onIsOpenChange={handleOpenChange}
        settings={settingsContent}
        content={chartContent}
      />
    </div>
  );
};
