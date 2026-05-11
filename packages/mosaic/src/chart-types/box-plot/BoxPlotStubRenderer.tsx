import React from 'react';
import type {ChartRendererProps} from '../base-types';
import type {BoxPlotChartSettings} from './schema';

/**
 * Stub renderer for box plot - will be replaced with real renderer in Task 5.
 * Box plots are currently rendered via dashboard-panel pattern.
 */
export function BoxPlotStubRenderer(
  _props: ChartRendererProps<BoxPlotChartSettings>,
) {
  return <div>Box Plot (panel renderer - to be implemented)</div>;
}
