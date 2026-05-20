import React from 'react';
import {useMosaicDashboardContext} from '../MosaicDashboardContext';
import {MosaicDashboardAddPanelDropdown} from './MosaicDashboardAddPanelDropdown';
import {MosaicDashboardResetFiltersButton} from './MosaicDashboardResetFiltersButton';

export const MosaicDashboardToolbar: React.FC = () => {
  const {dashboardId} = useMosaicDashboardContext();

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
