import {useStoreWithMosaicDashboard} from '@sqlrooms/mosaic';
import type {
  ChartDataPolicy,
  ChartRuntimeIssueContext,
  ChartRuntimeIssueReporter,
  MosaicDashboardPanelConfigType,
} from '@sqlrooms/mosaic';
import {useCallback, useMemo, useState} from 'react';
import {
  asDeckJsonMapConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  type DeckMapDashboardDatasetClientState,
} from './dashboardConfig';
import {getDeckMapDataPolicy} from './mapDataPolicy';

/**
 * Manages dataset state tracking, data policy, and runtime issue reporting
 * for a deck map dashboard panel's dataset clients.
 */
export function useDeckMapDatasets(options: {
  dashboardId: string;
  panel: MosaicDashboardPanelConfigType;
}) {
  const {dashboardId, panel} = options;
  const mapConfig = asDeckJsonMapConfig(panel.config);

  const reportPanelIssue = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.reportPanelIssue,
  );
  const clearPanelIssue = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.clearPanelIssue,
  );

  const [datasetStates, setDatasetStates] = useState<
    Record<string, DeckMapDashboardDatasetClientState>
  >({});

  const handleDatasetState = useCallback(
    (
      datasetId: string,
      state: DeckMapDashboardDatasetClientState | undefined,
    ) => {
      setDatasetStates((current) => {
        const next = {...current};
        if (state) {
          next[datasetId] = state;
        } else {
          delete next[datasetId];
        }
        return next;
      });
    },
    [],
  );

  const dataPolicy = useMemo<ChartDataPolicy>(
    () => getDeckMapDataPolicy(mapConfig),
    [mapConfig],
  );

  const runtimeIssueContext = useMemo<ChartRuntimeIssueContext>(
    () => ({
      panelId: panel.id,
      chartType: DECK_MAP_DASHBOARD_PANEL_TYPE,
    }),
    [panel.id],
  );

  const runtimeIssueReporter = useMemo<ChartRuntimeIssueReporter>(
    () => ({
      reportIssue: (issueToReport) => {
        reportPanelIssue(dashboardId, panel.id, issueToReport);
      },
      clearIssue: () => {
        clearPanelIssue(dashboardId, panel.id);
      },
    }),
    [clearPanelIssue, dashboardId, panel.id, reportPanelIssue],
  );

  const handleRenderingError = useCallback(
    (error: Error) => {
      reportPanelIssue(dashboardId, panel.id, {
        kind: 'render-error',
        panelId: panel.id,
        chartType: DECK_MAP_DASHBOARD_PANEL_TYPE,
        message: error.message,
        recoverable: true,
      });
    },
    [dashboardId, panel.id, reportPanelIssue],
  );

  return {
    datasetStates,
    handleDatasetState,
    dataPolicy,
    runtimeIssueContext,
    runtimeIssueReporter,
    handleRenderingError,
  };
}
