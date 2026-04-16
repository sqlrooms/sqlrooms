import {SpinnerPane} from '@sqlrooms/ui';
import React from 'react';
import {MosaicProfiler} from '../profiler/MosaicProfiler';
import {useMosaicDashboardContext} from './MosaicDashboardContext';
import {
  getMosaicDashboardSelectionName,
  useStoreWithMosaicDashboard,
} from './MosaicDashboardSlice';

export const MosaicDashboardProfiler: React.FC = () => {
  const {dashboardId} = useMosaicDashboardContext();
  const selectedTable = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.selectedTable,
  );
  const connection = useStoreWithMosaicDashboard(
    (state) => state.mosaic.connection,
  );

  if (!selectedTable) {
    return null;
  }

  if (connection.status === 'loading') {
    return <SpinnerPane className="h-48 w-full" />;
  }

  if (connection.status !== 'ready') {
    return null;
  }

  return (
    <MosaicProfiler
      tableName={selectedTable}
      pageSize={10}
      selectionName={getMosaicDashboardSelectionName(dashboardId)}
    >
      <div className="border-b">
        <div className="min-h-0 overflow-auto">
          <MosaicProfiler.Table>
            <MosaicProfiler.Header />
            <MosaicProfiler.Rows />
          </MosaicProfiler.Table>
        </div>
        <MosaicProfiler.StatusBar />
      </div>
    </MosaicProfiler>
  );
};
