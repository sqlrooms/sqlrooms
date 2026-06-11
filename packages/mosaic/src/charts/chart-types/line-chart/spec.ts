import type {Spec} from '@uwdata/mosaic-spec';
import {LineChartSettings} from './schema';
import {CreateSpecOptions} from '../base-types';
import {isTemporalType} from '../../../column-types-utils';
import {AggregateFunction} from '../../../schemas';
import {DEFAULT_CHART_FALLBACK_COLOR} from '../../../constants/chart-colors';
import {validateLineChartSettings} from './validation';

function getLegendLabel(
  yColumn: {field: string; aggregate?: AggregateFunction},
  hasAggregation: boolean,
): string {
  if (hasAggregation && yColumn.aggregate) {
    return `${yColumn.field} (${yColumn.aggregate.toUpperCase()})`;
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
  yColumns.forEach((yColumn) => {
    const color = yColumn.color ?? DEFAULT_CHART_FALLBACK_COLOR;
    const aggregate = yColumn.aggregate ?? 'sum';

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
    colorRange: yColumns.map(
      (yColumn) => yColumn.color ?? DEFAULT_CHART_FALLBACK_COLOR,
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
