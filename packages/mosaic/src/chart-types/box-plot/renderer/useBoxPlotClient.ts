import {Selection} from '@uwdata/mosaic-core';
import {useEffect, useRef, useState} from 'react';
import {BoxPlotClient, type BoxPlotState} from '../../../boxplot/BoxPlotClient';
import type {ChartRendererProps} from '../../base-types';
import {BoxPlotChartSettings} from '../schema';

export function useBoxPlotClient(args: {
  config: BoxPlotChartSettings | null;
  coordinator: ChartRendererProps['coordinator'];
  tableName: string;
}) {
  const {config, coordinator, tableName} = args;
  const [state, setState] = useState<BoxPlotState>({
    isLoading: true,
    outliers: [],
    summaries: [],
  });
  const clientRef = useRef<BoxPlotClient | null>(null);

  // Create a crossfilter selection for this box plot (only once)
  const [selection] = useState(() => Selection.crossfilter());

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
