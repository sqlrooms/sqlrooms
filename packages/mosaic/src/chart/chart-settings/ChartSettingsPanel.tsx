import {FC, useCallback} from 'react';
import {ChartSettings} from './ChartSettings';
import {type ChartConfig} from '../../chart-types/chart-config';
import {useTableColumns} from './useTableColumns';
import type {ChartPanelConfig} from '../../dashboard/dashboard-types';
import {useStoreWithMosaicDashboard} from '../../dashboard/MosaicDashboardSlice';
import {Spec} from '@uwdata/mosaic-spec';

interface ChartSettingsPanelProps {
  dashboardId: string;
  tableName: string;
  spec?: Spec;
  panel: ChartPanelConfig;
  onClose?: () => void;
  onViewSpec?: () => void;
}

export const ChartSettingsPanel: FC<ChartSettingsPanelProps> = ({
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
    <ChartSettings.Root
      tableName={tableName}
      config={config}
      columns={columns}
      onChange={handleSettingsChange}
    >
      <ChartSettings.Header>
        <div className="flex items-center">Chart settings</div>
        <div className="flex items-center gap-1">
          {spec && <ChartSettings.ViewSpecButton onClick={onViewSpec} />}
          {onClose && <ChartSettings.CloseButton onClick={onClose} />}
        </div>
      </ChartSettings.Header>
      <ChartSettings.Content>
        <ChartSettings.TypeSelector />
        <ChartSettings.Fields />
      </ChartSettings.Content>
    </ChartSettings.Root>
  );
};
