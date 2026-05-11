import React, {useMemo} from 'react';
import type {Spec} from '@uwdata/mosaic-spec';
import {VgPlotChart} from '../../VgPlotChart';
import type {ChartRendererProps} from '../base-types';
import type {EcdfChartSettings} from './schema';

const FG_COLOR = 'var(--color-chart-1)';

/**
 * Renderer for eCDF chart type.
 * Generates vgPlot spec internally and renders via VgPlotChart.
 */
export function EcdfRenderer({
  tableName,
  settings,
}: ChartRendererProps<EcdfChartSettings>) {
  const spec = useMemo((): Spec => {
    const {field} = settings;

    return {
      plot: [
        {
          mark: 'areaY',
          data: {from: tableName, filterBy: '$brush'},
          x: field,
          y: {sum: field, cumulative: true},
          fill: FG_COLOR,
          fillOpacity: 0.3,
        },
        {
          mark: 'lineY',
          data: {from: tableName, filterBy: '$brush'},
          x: field,
          y: {sum: field, cumulative: true},
          stroke: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: 'Cumulative',
      height: 250,
      width: 380,
      margins: {left: 50, right: 20, top: 20, bottom: 50},
      params: {brush: {select: 'crossfilter'}},
    } as Spec;
  }, [tableName, settings]);

  return <VgPlotChart spec={spec} />;
}
