import {Coordinator, Selection} from '@uwdata/mosaic-core';
import {useEffect, useMemo, useRef, useState} from 'react';
import {BoxPlotClient, type BoxPlotState} from './BoxPlotClient';
import type {BrushSelectionParams} from '../../base-types';
import type {
  ChartDataPolicy,
  ChartRuntimeIssueContext,
  ChartRuntimeIssueReporter,
} from '../../../../chart-runtime';
import {BoxPlotChartSettings} from '../schema';

export function useBoxPlotClient(args: {
  config: BoxPlotChartSettings | null;
  coordinator: Coordinator;
  dataPolicy?: ChartDataPolicy | null;
  params?: BrushSelectionParams;
  runtimeIssueContext?: ChartRuntimeIssueContext;
  runtimeIssueReporter?: ChartRuntimeIssueReporter;
  tableName: string;
}) {
  const {
    config,
    coordinator,
    dataPolicy,
    params,
    runtimeIssueContext,
    runtimeIssueReporter,
    tableName,
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
      tableName,
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
    tableName,
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
