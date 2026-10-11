import {type MosaicClient} from '@uwdata/mosaic-core';
import {useMemo} from 'react';
import type {VgPlotChartRetention} from '../VgPlotChart';

/**
 * Extracts chart interactors from a retained chart instance for panel client registration.
 * Chart interactors create filter clauses when users interact with the chart (e.g., brushing).
 */
export function useChartPanelClients(
  retention: VgPlotChartRetention | null | undefined,
): MosaicClient[] {
  return useMemo<MosaicClient[]>(() => {
    if (!retention?.chart) {
      return [];
    }

    // VgPlotChart element structure: element.value is the vgplot instance
    const element = retention.chart.element;
    const plotInstance = (element as any)?.value;

    if (!plotInstance) {
      return [];
    }

    // Interactors create clauses, so we need to register them as "clients" for filtering
    const interactors = plotInstance.interactors as
      | Array<MosaicClient>
      | undefined;
    return interactors ?? [];
  }, [retention?.chart]);
}
