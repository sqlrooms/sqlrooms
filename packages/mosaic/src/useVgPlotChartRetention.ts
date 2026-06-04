import {Param, Selection} from '@uwdata/mosaic-core';
import {useCallback, useEffect, useRef} from 'react';

export type RetainedVgPlotChart = {
  element: object;
  params?: Map<string, Param<any> | Selection>;
  specKey: string;
  error?: Error;
};

export type VgPlotChartRetention = {
  chart?: RetainedVgPlotChart;
  setChart: (chart: RetainedVgPlotChart) => void;
};

type PlotInstance = {
  marks?: Array<{destroy?: () => void}>;
  render?: () => Promise<unknown> | unknown;
  setAttribute?: (name: string, value: unknown) => boolean;
};

function getPlotInstance(element: object): PlotInstance | null {
  const plot = (element as HTMLElement & {value?: unknown}).value;
  return plot && typeof plot === 'object' ? (plot as PlotInstance) : null;
}

export function destroyRetainedVgPlotChart(chart: RetainedVgPlotChart) {
  const plot = getPlotInstance(chart.element);
  plot?.marks?.forEach((mark) => {
    mark.destroy?.();
  });
}

function areEquivalentParams(
  left?: Map<string, Param<any> | Selection>,
  right?: Map<string, Param<any> | Selection>,
) {
  if (left === right) {
    return true;
  }
  if (!left || !right || left.size !== right.size) {
    return false;
  }
  for (const [key, value] of left) {
    if (right.get(key) !== value) {
      return false;
    }
  }
  return true;
}

/**
 * Hook to manage chart retention (caching) across spec changes.
 * Handles chart lifecycle: retrieval, storage, and cleanup.
 */
export function useVgPlotChartRetention(
  specKey: string | null,
  params: Map<string, Param<any> | Selection> | undefined,
  externalRetention?: VgPlotChartRetention,
) {
  const localChartRef = useRef<RetainedVgPlotChart | null>(null);

  // Clean up old chart when spec changes
  useEffect(() => {
    const local = localChartRef.current;
    if (local && local.specKey !== specKey) {
      destroyRetainedVgPlotChart(local);
      localChartRef.current = null;
    }
  }, [specKey]);

  const getCachedChart = useCallback((): RetainedVgPlotChart | null => {
    const cached = externalRetention?.chart;
    const local = localChartRef.current;

    // Try local cache first
    if (
      local &&
      local.specKey === specKey &&
      areEquivalentParams(local.params, params)
    ) {
      return local;
    }

    // Try external cache
    if (
      cached &&
      cached.specKey === specKey &&
      areEquivalentParams(cached.params, params)
    ) {
      return cached;
    }

    return null;
  }, [specKey, params, externalRetention]);

  const setCachedChart = useCallback(
    (chart: RetainedVgPlotChart) => {
      localChartRef.current = chart;
      externalRetention?.setChart(chart);
    },
    [externalRetention],
  );

  return {getCachedChart, setCachedChart};
}
