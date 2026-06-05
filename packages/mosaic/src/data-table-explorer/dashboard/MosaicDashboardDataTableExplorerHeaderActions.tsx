import {type FC} from 'react';
import {usePanelClients} from '../../dashboard/usePanelClients';
import {usePanelResetFilters} from '../../dashboard/hooks/usePanelResetFilters';
import {ResetFiltersButton} from '../../dashboard/components/ResetFiltersButton';
import type {DataTableExplorerPanelRendererProps} from '../../dashboard/MosaicDashboardSlice';

export const MosaicDashboardDataTableExplorerHeaderActions: FC<
  DataTableExplorerPanelRendererProps
> = ({dashboardId, panel, selectionName}) => {
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
