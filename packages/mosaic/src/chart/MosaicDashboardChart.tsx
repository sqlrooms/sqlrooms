import {type FC, useCallback} from 'react';
import {MosaicDashboardPanelLayout} from '../dashboard/MosaicDashboardPanelLayout';
import type {ChartPanelConfig} from '../dashboard/dashboard-types';
import {useStoreWithMosaicDashboard} from '../dashboard/MosaicDashboardSlice';
import {useGenerateSpec} from './useGenerateSpec';
import {MosaicReadyConnection} from '../MosaicSlice';
import {ChartTypeDefinition} from '../chart-types/base-types';
import {MosaicDashboardChartContent} from './MosaicDashboardChartContent';
import {MosaicChartSettingsPanel} from './MosaicChartSettingsPanel';
import type {ChartConfig} from '../chart-types/chart-config';

export type MosaicDashboardChartProps = {
  dashboardId: string;
  chartTypeDef: ChartTypeDefinition;
  tableName: string;
  connection: MosaicReadyConnection;
  selectionName: string;
  panel: ChartPanelConfig;
};

export const MosaicDashboardChart: FC<MosaicDashboardChartProps> = ({
  chartTypeDef,
  tableName,
  connection,
  dashboardId,
  selectionName,
  panel,
}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const isSettingsOpen = panel.config.settingsOpen;

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      updatePanel(dashboardId, panel.id, {
        config: {...panel.config, settingsOpen: isOpen},
      });
    },
    [dashboardId, panel.config, panel.id, updatePanel],
  );

  const handleConfigChange = useCallback(
    (config: ChartConfig) => {
      updatePanel(dashboardId, panel.id, {config});
    },
    [dashboardId, panel.id, updatePanel],
  );

  const spec = useGenerateSpec(tableName, panel.config.settings, chartTypeDef);

  const settingsContent = (
    <MosaicChartSettingsPanel
      spec={spec.spec}
      tableName={tableName}
      config={panel.config}
      onChange={handleConfigChange}
      onClose={() => handleOpenChange(false)}
    />
  );

  const chartContent = (
    <div className="h-full overflow-auto p-2">
      <MosaicDashboardChartContent
        dashboardId={dashboardId}
        panel={panel}
        selectionName={selectionName}
        chartTypeDefinition={chartTypeDef}
        tableName={tableName}
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
