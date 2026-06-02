import {type FC, useCallback} from 'react';
import {MosaicDashboardPanelLayout} from '../dashboard/panel/MosaicDashboardPanelLayout';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import type {ChartConfig} from './chart-types/chart-config';
import {MosaicChartView} from './MosaicChartView';

export type MosaicChartProps = {
  tableName?: string;
  selectionName: string;
  config: ChartConfig;
  runtimeKey: string;
  onConfigChange?: (config: ChartConfig) => void;
};

export const MosaicChart: FC<MosaicChartProps> = ({
  tableName,
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
      tableName={tableName}
      config={config}
      onChange={handleConfigChange}
      onClose={() => handleOpenChange(false)}
    />
  );

  const chartContent = (
    <div className="h-full overflow-auto p-2">
      <MosaicChartView
        tableName={tableName}
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
