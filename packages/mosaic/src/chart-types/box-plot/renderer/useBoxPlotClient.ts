import {Coordinator, Selection} from '@uwdata/mosaic-core';
import {useEffect, useMemo, useRef, useState} from 'react';
import {BoxPlotClient, type BoxPlotState} from '../../../boxplot/BoxPlotClient';
import type {BrushSelectionParams} from '../../base-types';
import {BoxPlotChartSettings} from '../schema';

export function useBoxPlotClient(args: {
  config: BoxPlotChartSettings | null;
  coordinator: Coordinator;
  params?: BrushSelectionParams;
  tableName: string;
}) {
  const {config, coordinator, params, tableName} = args;
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
    if (!config) {
      clientRef.current = null;
      return;
    }

    const client = new BoxPlotClient({
      onStateChange: setState,
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
  }, [config, coordinator, selection, tableName]);

  return {clientRef, state};
}
