import {type FC} from 'react';
import {type ChartPanelRendererProps} from '../../dashboard/MosaicDashboardSlice';
import {usePanelClients} from '../../dashboard/usePanelClients';
import {usePanelResetFilters} from '../../dashboard/hooks/usePanelResetFilters';
import {ResetFiltersButton} from '../../dashboard/components/ResetFiltersButton';

export const MosaicDashboardChartHeaderActions: FC<ChartPanelRendererProps> = ({
  dashboardId,
  panel,
  selectionName,
}) => {
  const panelClients = usePanelClients(dashboardId, panel.id);
  const {hasActiveFilters, reset} = usePanelResetFilters({
    panelClients,
    selectionName,
  });

  return (
    <ResetFiltersButton
      disabled={!hasActiveFilters}
      onClick={reset}
      tooltip="Reset panel filters"
    />
  );
};
