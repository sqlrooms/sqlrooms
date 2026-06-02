import {FC, useCallback} from 'react';
import {MosaicChartSettings} from './MosaicChartSettings';
import {type ChartConfig} from '../../chart-types/chart-config';
import {useTableColumns} from './useTableColumns';
import type {ChartPanelConfig} from '../../dashboard/dashboard-types';
import {useStoreWithMosaicDashboard} from '../../dashboard/MosaicDashboardSlice';
import {Spec} from '@uwdata/mosaic-spec';

interface MosaicChartSettingsPanelProps {
  dashboardId: string;
  tableName: string;
  spec?: Spec;
  panel: ChartPanelConfig;
  onClose?: () => void;
  onViewSpec?: () => void;
}

export const MosaicChartSettingsPanel: FC<MosaicChartSettingsPanelProps> = ({
  dashboardId,
  panel,
  tableName,
  spec,
  onClose,
  onViewSpec,
}) => {
  const config = panel.config;

  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const columns = useTableColumns(tableName);

  const handleSettingsChange = useCallback(
    (config: ChartConfig) => {
      updatePanel(dashboardId, panel.id, {
        config,
      });
    },
    [dashboardId, panel.id, updatePanel],
  );

  return (
    <MosaicChartSettings.Root
      tableName={tableName}
      config={config}
      columns={columns}
      onChange={handleSettingsChange}
    >
      <MosaicChartSettings.Header>
        <div className="flex items-center">Chart settings</div>
        <div className="flex items-center gap-1">
          {spec && <MosaicChartSettings.ViewSpecButton onClick={onViewSpec} />}
          {onClose && <MosaicChartSettings.CloseButton onClick={onClose} />}
        </div>
      </MosaicChartSettings.Header>
      <MosaicChartSettings.Content>
        <MosaicChartSettings.TypeSelector />
        <MosaicChartSettings.Fields />
      </MosaicChartSettings.Content>
    </MosaicChartSettings.Root>
  );
};
