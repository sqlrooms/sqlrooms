import {
  createDefaultChartTypes,
  createDefaultMosaicDashboardPanelRenderers,
  defaultAddPanelActions,
  type CreateMosaicDashboardSliceProps,
} from '@sqlrooms/mosaic';
import {
  deckMapDashboardAddPanelAction,
  deckMapDashboardPanelRenderer,
} from './dashboard';
import {DECK_MAP_DASHBOARD_PANEL_TYPE} from './dashboardConfig';

export function createDeckMapDashboardSliceOptions(): CreateMosaicDashboardSliceProps {
  return {
    panelRenderers: createDefaultMosaicDashboardPanelRenderers({
      [DECK_MAP_DASHBOARD_PANEL_TYPE]: deckMapDashboardPanelRenderer,
    }),
    addPanelActions: [
      ...defaultAddPanelActions,
      deckMapDashboardAddPanelAction,
    ],
    chartTypes: createDefaultChartTypes(),
  };
}
