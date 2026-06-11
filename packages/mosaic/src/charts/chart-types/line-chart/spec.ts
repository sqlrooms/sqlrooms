import type {Spec} from '@uwdata/mosaic-spec';
import {LineChartSettings} from './schema';
import {CreateSpecOptions} from '../base-types';
import {isTemporalType} from '../../../column-types-utils';
import {AggregateFunction} from '../../../schemas';
import {validateLineChartSettings} from './validation';

// Chart color palette matching theme colors from tailwind-preset.css
const CHART_COLORS = [
  '#ea7c5c', // chart-1: hsl(12, 76%, 61%)
  '#2a9d8f', // chart-2: hsl(173, 58%, 39%)
  '#264653', // chart-3: hsl(197, 37%, 24%)
  '#e9c46a', // chart-4: hsl(43, 74%, 66%)
  '#f4a261', // chart-5: hsl(27, 87%, 67%)
];

function getLineColor(color: string | undefined, index: number): string {
  if (color) {
    return color;
  }
  // CHART_COLORS is non-empty, so this is always defined
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

function getLegendLabel(
  yColumn: {field: string; aggregate?: AggregateFunction},
  hasAggregation: boolean,
): string {
  if (hasAggregation && yColumn.aggregate) {
    return `${yColumn.field} (${yColumn.aggregate})`;
  }
  return yColumn.field;
}

export function createLineChartSpec(
  options: CreateSpecOptions<LineChartSettings>,
): Spec {
  const {dataTable, selectionName, settings} = options;

  const {xColumn, yColumns, xInterval} = validateLineChartSettings(options);

  const isXTemporal = isTemporalType(xColumn.type);

  const plotMarks: unknown[] = [];

  // Data source always includes filterBy for brush
  const dataSource = {from: dataTable.table.table, filterBy: '$brush'};

  // Generate lineY marks for each Y field
  yColumns.forEach((yColumn, index) => {
    const color = getLineColor(yColumn.color, index);
    const aggregate = yColumn.aggregate || 'sum';

    // When temporal aggregation is active, use bin for X and aggregation for Y
    if (isXTemporal && xInterval) {
      // Use bin syntax for temporal aggregation
      plotMarks.push({
        mark: 'lineY',
        data: dataSource,
        x: {bin: xColumn.name, interval: xInterval},
        y: {[aggregate]: yColumn.column.name},
        stroke: color,
      });
    } else {
      // No aggregation - direct field references
      plotMarks.push({
        mark: 'lineY',
        data: dataSource,
        x: xColumn.name,
        y: yColumn.column.name,
        stroke: color,
      });
    }
  });

  // Add brush control only if selectionName is provided
  if (selectionName) {
    plotMarks.push({select: 'intervalX', as: '$brush'});
  }

  const showLegend = settings.showLegend ?? true;

  const plotSpec = {
    plot: plotMarks,
    name: 'lineChart',
    xLabel: xColumn.name,
    yLabel: undefined,
    margins: {
      left: 50,
      right: 20,
      top: 20,
      bottom: 50,
    },
    colorDomain: yColumns.map((yColumn) =>
      getLegendLabel(
        {field: yColumn.column.name, aggregate: yColumn.aggregate},
        Boolean(isXTemporal && xInterval),
      ),
    ),
    colorRange: yColumns.map((yColumn, index) =>
      getLineColor(yColumn.color, index),
    ),
  };

  if (!showLegend) {
    return {
      ...plotSpec,
      params: {brush: {select: 'crossfilter'}},
    } as Spec;
  }

  return {
    vconcat: [
      plotSpec,
      {
        legend: 'color',
        for: 'lineChart',
        columns: yColumns.length,
      },
    ],
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
