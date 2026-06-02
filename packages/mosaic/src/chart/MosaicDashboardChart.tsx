import {type FC, useCallback} from 'react';
import {MosaicDashboardPanelLayout} from '../dashboard/MosaicDashboardPanelLayout';
import {useGenerateSpec} from './useGenerateSpec';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import type {ChartConfig} from '../chart-types/chart-config';
import {useChartTypeDefinition} from '../chart-types/useChartTypeDefinition';
import {MosaicChartView} from './MosaicChartView';

export type MosaicDashboardChartProps = {
  tableName: string;
  selectionName: string;
  config: ChartConfig;
  runtimeKey: string;
  onConfigChange?: (config: ChartConfig) => void;
};

// TODO: rename it, since it can be used outside of dashboards too
export const MosaicDashboardChart: FC<MosaicDashboardChartProps> = ({
  tableName,
  selectionName,
  config,
  runtimeKey,
  onConfigChange,
}) => {
  const isSettingsOpen = config.settingsOpen;

  const handleOpenChange = useCallback(
    (isOpen: boolean) => onConfigChange?.({...config, settingsOpen: isOpen}),
    [config, onConfigChange],
  );

  const handleConfigChange = useCallback(
    (newConfig: ChartConfig) => onConfigChange?.(newConfig),
    [onConfigChange],
  );

  const chartTypeDef = useChartTypeDefinition(config.chartType);

  const spec = useGenerateSpec(tableName, config.settings, chartTypeDef);

  if (!chartTypeDef) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Unknown chart type: {config.chartType}
      </div>
    );
  }

  const settingsContent = (
    <MosaicChartSettingsPanel
      spec={spec.spec}
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
        chartTypeDefinition={chartTypeDef}
      />
    </div>
  );

  return (
    <div className="h-full min-h-0">
      <MosaicDashboardPanelLayout
        isOpen={isSettingsOpen}
        onIsOpenChange={handleOpenChange}
        settings={settingsContent}
        content={chartContent}
      />
    </div>
  );
};
