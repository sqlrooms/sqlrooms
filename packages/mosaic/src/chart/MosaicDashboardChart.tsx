import {type FC, useCallback} from 'react';
import {ChartSettingsContent} from './chart-settings/ChartSettingsContent';
import {MosaicDashboardPanelLayout} from '../dashboard/MosaicDashboardPanelLayout';
import {
  type ChartPanelConfig,
  useStoreWithMosaicDashboard,
} from '../dashboard/MosaicDashboardSlice';
import {useGenerateSpec} from './useGenerateSpec';
import {MosaicReadyConnection} from '../MosaicSlice';
import {ChartTypeDefinition} from '../chart-types/base-types';
import {MosaicDashboardChartContent} from './MosaicDashboardChartContent';

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

  const spec = useGenerateSpec(tableName, panel.config.settings, chartTypeDef);

  const settingsContent = (
    <ChartSettingsContent
      dashboardId={dashboardId}
      panel={panel}
      spec={spec.spec}
      tableName={tableName}
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
        connection={connection}
        spec={spec}
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
