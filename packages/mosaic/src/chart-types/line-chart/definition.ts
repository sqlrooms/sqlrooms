import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from '../../chart-builders/types';
import type {LineChartSettings} from './schema';
import {
  buildDefaultChartTitle,
  QUANTITATIVE_COLUMN_TYPES,
  NUMERIC_COLUMN_TYPES,
} from '../../chart-builders/constants';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

function getLineColor(
  fieldConfig: {field: string; color?: string},
  index: number,
): string {
  return fieldConfig.color || `var(--color-chart-${index + 1})`;
}

export const lineChartChartType: ChartTypeDefinition<LineChartSettings> = {
  id: 'line-chart',
  label: 'Line Chart',
  description: 'Create a line chart with one or more Y fields',
  aiDescription:
    'Use for trends over an ordered x-axis, typically time on x and numeric measures on y. Supports multiple Y fields for comparing trends.',
  fields: [
    {
      key: 'x',
      label: 'X Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description:
        'Ordered x-axis column, usually time or a quantitative value.',
    },
    {
      key: 'yFields',
      label: 'Y Fields',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric measures plotted on the y-axis.',
      multiple: true,
    },
  ],
  buildTitle: titleFromDescription(
    'Create a line chart with one or more Y fields',
  ),
  createSpec: (tableName, {x, yFields}): Spec => {
    if (!yFields || yFields.length === 0) {
      throw new Error('At least one Y field is required');
    }

    const plotMarks: any[] = [];

    // Generate lineY and text marks for each Y field
    yFields.forEach((fieldConfig, index) => {
      const color = getLineColor(fieldConfig, index);

      // Add line mark
      plotMarks.push({
        mark: 'lineY',
        data: {from: tableName, filterBy: '$brush'},
        x,
        y: fieldConfig.field,
        stroke: color,
      });

      // Add text label mark
      plotMarks.push({
        mark: 'text',
        data: {from: tableName, filterBy: '$brush'},
        x,
        y: fieldConfig.field,
        text: [fieldConfig.field],
        fill: color,
        dx: 5,
        dy: -5,
      });
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
  },
};
