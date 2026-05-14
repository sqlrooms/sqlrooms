import * as Plot from '@observablehq/plot';
import type {PlotSize} from '../../../ResponsivePlot';
import {
  BOX_FILL,
  BOX_STROKE,
  GRID_COLOR,
  MARGINS,
  MAX_BOX_ITEM_WIDTH,
  OUTLIER_FILL,
  type PlotOutlierDatum,
  type PlotSummaryDatum,
} from './constants';

export function createBoxPlotElement(args: {
  config: {x: string; y: string};
  domain: [number, number];
  outliers: PlotOutlierDatum[];
  size: PlotSize;
  summaries: PlotSummaryDatum[];
}) {
  const {config, domain, outliers, size, summaries} = args;
  const categories = summaries.map((row) => row.categoryLabel);
  const innerWidth = Math.max(0, size.width - MARGINS.left - MARGINS.right);
  const categoryBandWidth = categories.length
    ? innerWidth / categories.length
    : MAX_BOX_ITEM_WIDTH;
  const boxInset = Math.max(0, (categoryBandWidth - MAX_BOX_ITEM_WIDTH) / 2);

  return Plot.plot({
    height: size.height,
    marginBottom: MARGINS.bottom,
    marginLeft: MARGINS.left,
    marginRight: MARGINS.right,
    marginTop: MARGINS.top,
    style: {
      background: 'transparent',
      color: 'currentColor',
      font: '12px var(--font-sans, system-ui, sans-serif)',
      overflow: 'visible',
    },
    width: size.width,
    x: {
      domain: categories,
      label: config.x,
      padding: 0,
      tickRotate: categories.length > 8 ? -35 : 0,
    },
    y: {
      domain,
      grid: true,
      label: config.y,
      nice: true,
    },
    marks: [
      Plot.gridY({stroke: GRID_COLOR, strokeOpacity: 0.65}),
      Plot.ruleX(summaries, {
        x: 'categoryLabel',
        y1: 'whiskerLow',
        y2: 'whiskerHigh',
        stroke: BOX_STROKE,
        strokeWidth: 1.2,
      }),
      Plot.tickY(summaries, {
        insetLeft: boxInset,
        insetRight: boxInset,
        x: 'categoryLabel',
        y: 'whiskerLow',
        stroke: BOX_STROKE,
        strokeWidth: 1.4,
      }),
      Plot.tickY(summaries, {
        insetLeft: boxInset,
        insetRight: boxInset,
        x: 'categoryLabel',
        y: 'whiskerHigh',
        stroke: BOX_STROKE,
        strokeWidth: 1.4,
      }),
      Plot.rectY(summaries, {
        fill: BOX_FILL,
        fillOpacity: 0.22,
        insetLeft: boxInset,
        insetRight: boxInset,
        stroke: BOX_STROKE,
        strokeWidth: 1.2,
        x: 'categoryLabel',
        y1: 'q1',
        y2: 'q3',
      }),
      Plot.tickY(summaries, {
        insetLeft: boxInset,
        insetRight: boxInset,
        x: 'categoryLabel',
        y: 'median',
        stroke: BOX_STROKE,
        strokeWidth: 2.4,
      }),
      Plot.dot(outliers, {
        fill: OUTLIER_FILL,
        fillOpacity: 0.7,
        r: 2.5,
        stroke: 'transparent',
        x: 'categoryLabel',
        y: 'value',
      }),
    ],
  });
}
