import type {
  MosaicDashboardEntryType,
  MosaicDashboardPanelConfigType,
} from '@sqlrooms/mosaic';
import {useEffect, useMemo, useState, type RefObject} from 'react';
import {
  asDeckJsonMapConfig,
  resolveDeckMapDashboardDatasetSource,
} from './dashboardConfig';
import {
  resolveDeckMapFitToData,
  useDeckMapFitController,
} from './mapFit';
import type {DeckJsonMapHandle} from './types';

export {createDeckMapBoundsQuery} from './mapFit';

const deckMapDashboardFitRequestTarget = new EventTarget();

/**
 * Requests a manual fit-to-data operation for a Mosaic dashboard map panel.
 *
 * @param panelId - Dashboard panel whose map view should be fitted.
 */
export function emitDeckMapDashboardFitRequest(panelId: string) {
  deckMapDashboardFitRequestTarget.dispatchEvent(
    new CustomEvent('fit-view', {detail: {panelId}}),
  );
}

/**
 * Adapts Mosaic dashboard state and panel fit events to the shared Deck fit
 * controller.
 *
 * This adapter resolves dashboard-selected table semantics while keeping all
 * query execution, viewport calculation, and request state in the host-neutral
 * fit engine.
 *
 * @param options - Mosaic dashboard/panel state and rendered map/container refs.
 * @returns The normalized fit configuration used by dashboard dataset clients.
 */
export function useDeckMapFitToBounds(options: {
  panelId: string;
  dashboard: MosaicDashboardEntryType;
  panel: MosaicDashboardPanelConfigType;
  container: HTMLElement | null;
  deckMapRef: RefObject<DeckJsonMapHandle | null>;
}) {
  const {panelId, dashboard, panel, container, deckMapRef} = options;
  const mapConfig = asDeckJsonMapConfig(panel.config);
  const fitToData = useMemo(
    () => resolveDeckMapFitToData(mapConfig),
    [mapConfig],
  );
  const source = useMemo(
    () =>
      fitToData
        ? (resolveDeckMapDashboardDatasetSource({
            dashboard,
            panel,
            dataset: mapConfig?.datasets[fitToData.dataset],
          }) ?? null)
        : null,
    [dashboard, fitToData, mapConfig?.datasets, panel],
  );
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const handleFitRequest = (event: Event) => {
      const detail = (event as CustomEvent<{panelId?: string}>).detail;
      if (detail?.panelId === panelId) {
        setRequestVersion((version) => version + 1);
      }
    };
    deckMapDashboardFitRequestTarget.addEventListener(
      'fit-view',
      handleFitRequest,
    );
    return () =>
      deckMapDashboardFitRequestTarget.removeEventListener(
        'fit-view',
        handleFitRequest,
      );
  }, [panelId]);

  useDeckMapFitController({
    scopeId: panelId,
    fitToData,
    source,
    container,
    deckMapRef,
    requestVersion,
    autoFit: true,
  });

  return {fitToData};
}
