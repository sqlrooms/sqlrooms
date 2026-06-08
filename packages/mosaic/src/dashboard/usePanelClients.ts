import {type MosaicClient} from '@uwdata/mosaic-core';
import {
  useStoreWithMosaicDashboard,
  getMosaicDashboardPanelId,
} from './MosaicDashboardSlice';

/**
 * Returns the list of registered Mosaic clients for a specific dashboard panel.
 * These clients are used to determine which filters originate from this panel.
 */
export function usePanelClients(
  dashboardId: string,
  panelId: string,
): MosaicClient[] {
  const panelClientsFromStore = useStoreWithMosaicDashboard((state) => {
    const key = getMosaicDashboardPanelId(dashboardId, panelId);
    return state.mosaicDashboard.runtime.panelClients[key];
  });

  return panelClientsFromStore ?? [];
}
