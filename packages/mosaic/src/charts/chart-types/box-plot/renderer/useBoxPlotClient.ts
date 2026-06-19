import {Coordinator, Selection} from '@uwdata/mosaic-core';
import {useEffect, useMemo, useRef, useState} from 'react';
import {BoxPlotClient, type BoxPlotState} from './BoxPlotClient';
import type {BrushSelectionParams} from '../../base-types';
import type {QualifiedTableName} from '@sqlrooms/duckdb';
import type {
  ChartDataPolicy,
  ChartRuntimeIssueContext,
  ChartRuntimeIssueReporter,
} from '../../../../chart-runtime';
import {BoxPlotChartSettings} from '../schema';

/**
 * Creates and connects the Mosaic client used by the box plot renderer.
 *
 * @param args - Hook inputs including chart settings, Mosaic coordinator,
 *   optional dashboard services, and the resolved source table.
 * @param args.table - Canonical `QualifiedTableName` for the source table. The
 *   hook passes this structured identity through to {@link BoxPlotClient}, where
 *   it is converted to a Mosaic SQL table reference at query-build time.
 * @returns The active client ref and normalized renderer state.
 */
export function useBoxPlotClient(args: {
  config: BoxPlotChartSettings | null;
  coordinator: Coordinator;
  dataPolicy?: ChartDataPolicy | null;
  params?: BrushSelectionParams;
  runtimeIssueContext?: ChartRuntimeIssueContext;
  runtimeIssueReporter?: ChartRuntimeIssueReporter;
  table: QualifiedTableName;
}) {
  const {
    config,
    coordinator,
    dataPolicy,
    params,
    runtimeIssueContext,
    runtimeIssueReporter,
    table,
  } = args;
  const [state, setState] = useState<BoxPlotState>({
    isLoading: true,
    outliers: [],
    summaries: [],
  });
  const clientRef = useRef<BoxPlotClient | null>(null);

  // Get or create the crossfilter selection
  const selection = useMemo(() => {
    // First try to get the brush selection from params (which should be connected to crossfilter)
    const brushSelection = params?.get('brush');
    if (brushSelection) {
      return brushSelection;
    }
    // Fallback: create a new crossfilter selection (shouldn't happen in dashboard context)
    return Selection.crossfilter();
  }, [params]);

  useEffect(() => {
    if (!config || !config.x || !config.y) {
      clientRef.current = null;
      return;
    }

    const client = new BoxPlotClient({
      dataPolicy,
      onStateChange: setState,
      runtimeIssueContext,
      runtimeIssueReporter,
      selection,
      table,
      x: config.x,
      y: config.y,
    });
    clientRef.current = client;
    coordinator.connect(client);

    return () => {
      client.destroy();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [
    config,
    coordinator,
    dataPolicy,
    runtimeIssueContext,
    runtimeIssueReporter,
    selection,
    table,
  ]);

  const effectiveState =
    !config || !config.x || !config.y
      ? {
          isLoading: false,
          outliers: [],
          summaries: [],
        }
      : state;

  return {clientRef, state: effectiveState};
}
