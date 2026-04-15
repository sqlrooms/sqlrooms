import {MosaicDashboard} from '@sqlrooms/mosaic';
import type {RoomPanelComponent} from '@sqlrooms/layout';
import {useEffect} from 'react';
import {useRoomStore} from '../../store';

export const DashboardSheet: RoomPanelComponent = ({panelInfo}) => {
  const sheetId = panelInfo.panelId;
  const sheet = useRoomStore((state) => state.cells.config.sheets[sheetId]);
  const ensureSheetDashboard = useRoomStore(
    (state) => state.dashboard.ensureSheetDashboard,
  );

  useEffect(() => {
    if (sheet?.type === 'dashboard') {
      ensureSheetDashboard(sheetId);
    }
  }, [ensureSheetDashboard, sheet?.type, sheetId]);

  if (!sheet || sheet.type !== 'dashboard') {
    return null;
  }

  return <MosaicDashboard dashboardId={sheetId} />;
};
