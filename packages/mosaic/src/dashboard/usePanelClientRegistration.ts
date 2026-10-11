import {type MosaicClient} from '@uwdata/mosaic-core';
import {useEffect} from 'react';
import {useStoreWithMosaicDashboard} from './MosaicDashboardSlice';

/**
 * Registers Mosaic clients for a dashboard panel so the panel's reset button
 * can track which filters originate from this panel.
 */
export function usePanelClientRegistration(
  dashboardId: string | undefined,
  panelId: string | undefined,
  clients: MosaicClient[],
): void {
  const registerPanelClient = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.registerPanelClient,
  );
  const unregisterPanelClient = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.unregisterPanelClient,
  );

  useEffect(() => {
    if (!dashboardId || !panelId || clients.length === 0) {
      return;
    }

    clients.forEach((client) => {
      registerPanelClient(dashboardId, panelId, client);
    });

    return () => {
      clients.forEach((client) => {
        unregisterPanelClient(dashboardId, panelId, client);
      });
    };
  }, [
    dashboardId,
    panelId,
    clients,
    registerPanelClient,
    unregisterPanelClient,
  ]);
}
