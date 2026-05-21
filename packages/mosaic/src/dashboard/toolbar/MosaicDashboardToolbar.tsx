import React from 'react';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {useStoreWithMosaicDashboard} from '../MosaicDashboardSlice';
import {MosaicDashboardAddPanelDropdown} from './MosaicDashboardAddPanelDropdown';
import {MosaicDashboardResetFiltersButton} from './MosaicDashboardResetFiltersButton';

export const MosaicDashboardToolbar: React.FC = () => {
  const {dashboardId} = useMosaicDashboardContext();
  const hasPanels = useStoreWithMosaicDashboard(
    (state) =>
      (state.mosaicDashboard.config.dashboardsById[dashboardId]?.panels
        ?.length ?? 0) > 0,
  );

  if (!hasPanels) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-b px-5 py-2">
      <div className="flex items-center gap-2">
        <MosaicDashboardResetFiltersButton dashboardId={dashboardId} />
      </div>
      <div className="flex items-center gap-2">
        <MosaicDashboardAddPanelDropdown dashboardId={dashboardId} />
      </div>
    </div>
  );
};
