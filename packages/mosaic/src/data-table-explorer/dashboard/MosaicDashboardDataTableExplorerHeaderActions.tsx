import {type FC} from 'react';
import {MosaicDashboardPanelResetButton} from '../../dashboard/panel/MosaicDashboardPanelResetButton';
import type {DataTableExplorerPanelRendererProps} from '../../dashboard/MosaicDashboardSlice';

export const MosaicDashboardDataTableExplorerHeaderActions: FC<
  DataTableExplorerPanelRendererProps
> = ({dashboardId, panel, selectionName}) => {
  return (
    <MosaicDashboardPanelResetButton
      dashboardId={dashboardId}
      panelId={panel.id}
      selectionName={selectionName}
    />
  );
};
