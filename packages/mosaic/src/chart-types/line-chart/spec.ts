import type {Spec} from '@uwdata/mosaic-spec';
import {LineChartSettings} from './schema';
import {SpecGenerationError} from '../errors';

// Chart color palette matching theme colors from tailwind-preset.css
const CHART_COLORS = [
  '#ea7c5c', // chart-1: hsl(12, 76%, 61%)
  '#2a9d8f', // chart-2: hsl(173, 58%, 39%)
  '#264653', // chart-3: hsl(197, 37%, 24%)
  '#e9c46a', // chart-4: hsl(43, 74%, 66%)
  '#f4a261', // chart-5: hsl(27, 87%, 67%)
];

function getLineColor(
  fieldConfig: {field: string; color?: string},
  index: number,
): string {
  if (fieldConfig.color) {
    return fieldConfig.color;
  }
  // CHART_COLORS is non-empty, so this is always defined
  return CHART_COLORS[index % CHART_COLORS.length]!;
}

export function createLineChartSpec(
  tableName: string,
  {x, yFields, xInterval}: LineChartSettings,
): Spec {
  if (!x) {
    throw new SpecGenerationError('X field is required for line chart');
  }
  if (!yFields || yFields.length === 0) {
    throw new SpecGenerationError(
      'At least one Y field is required for line chart',
    );
  }

  const plotMarks: any[] = [];

  // When temporal aggregation is active, use SQL binning
  const dataSource = xInterval
    ? {
        from: tableName,
        filterBy: '$brush',
      }
    : {from: tableName, filterBy: '$brush'};

  // Generate lineY and text marks for each Y field
  yFields.forEach((fieldConfig, index) => {
    const color = getLineColor(fieldConfig, index);
    const aggregate = fieldConfig.aggregate || 'sum';

    // When temporal aggregation is active, use bin for X and aggregation for Y
    if (xInterval) {
      // Use bin syntax for temporal aggregation
      plotMarks.push({
        mark: 'lineY',
        data: dataSource,
        x: {bin: x, interval: xInterval},
        y: {[aggregate]: fieldConfig.field},
        stroke: color,
      });

      // Text label with aggregation info
      plotMarks.push({
        mark: 'text',
        data: dataSource,
        x: {bin: x, interval: xInterval},
        y: {[aggregate]: fieldConfig.field},
        text: [`${fieldConfig.field} (${aggregate})`],
        fill: color,
        dx: 5,
        dy: -5,
      });
    } else {
      // No aggregation - direct field references
      plotMarks.push({
        mark: 'lineY',
        data: dataSource,
        x,
        y: fieldConfig.field,
        stroke: color,
      });

      plotMarks.push({
        mark: 'text',
        data: dataSource,
        x,
        y: fieldConfig.field,
        text: [fieldConfig.field],
        fill: color,
        dx: 5,
        dy: -5,
      });
    }
  });

  // Add brush
  plotMarks.push({select: 'intervalX', as: '$brush'});

  return {
    plot: plotMarks,
    xLabel: x,
    yLabel: undefined,
    height: 250,
    width: 380,
    margins: {left: 50, right: 20, top: 20, bottom: 50},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}
