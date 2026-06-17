import {type FC, useCallback} from 'react';
import {
  type ChartPanelRendererProps,
  useStoreWithMosaicDashboard,
} from '../../dashboard/MosaicDashboardSlice';
import {usePanelClients} from '../../dashboard/usePanelClients';
import {usePanelResetFilters} from '../../dashboard/hooks/usePanelResetFilters';
import {ResetFiltersButton} from '../../dashboard/components/ResetFiltersButton';
import {MosaicChartSettingsButton} from '../MosaicChartSettingsButton';

export const MosaicDashboardChartHeaderActions: FC<ChartPanelRendererProps> = ({
  dashboardId,
  panel,
  selectionName,
}) => {
  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );
  const panelClients = usePanelClients(dashboardId, panel.id);
  const {hasActiveFilters, reset} = usePanelResetFilters({
    panelClients,
    selectionName,
  });

  const isSettingsOpen = Boolean(panel.config.settingsOpen);

  const handleToggleSettings = useCallback(() => {
    updatePanel(dashboardId, panel.id, {
      config: {...panel.config, settingsOpen: !isSettingsOpen},
    });
  }, [dashboardId, isSettingsOpen, panel.config, panel.id, updatePanel]);

  return (
    <>
      <ResetFiltersButton
        disabled={!hasActiveFilters}
        onClick={reset}
        tooltip="Reset panel filters"
      />
      <MosaicChartSettingsButton
        isSettingsOpen={isSettingsOpen}
        onToggleSettings={handleToggleSettings}
      />
    </>
  );
};
