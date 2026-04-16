import type {Spec} from '@uwdata/mosaic-spec';
import type {ChartTypeDefinition} from './types';
import {
  buildDefaultChartTitle,
  NUMERIC_COLUMN_TYPES,
  QUANTITATIVE_COLUMN_TYPES,
  TEMPORAL_COLUMN_TYPES,
} from './chartTypeUtils';

const BG_COLOR = 'var(--color-chart-overlay)';
const FG_COLOR = 'var(--color-chart-1)';

function titleFromDescription(description: string) {
  return (fieldValues: Record<string, string>) =>
    buildDefaultChartTitle(description, fieldValues);
}

export const countPlotChartType: ChartTypeDefinition = {
  id: 'count-plot',
  label: 'Count Plot',
  description: 'Create a count plot of a field',
  aiDescription:
    'Use for a quick binned distribution of one numeric or temporal column.',
  fields: [
    {
      key: 'field',
      label: 'Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description: 'Numeric or temporal column to bin along the x-axis.',
    },
  ],
  buildTitle: titleFromDescription('Create a count plot of a field'),
  createSpec: (tableName, {field}): Spec =>
    ({
      plot: [
        {
          mark: 'rectY',
          data: {from: tableName},
          x: {bin: field, maxbins: 25},
          y: {count: null},
          fill: BG_COLOR,
          inset: 0.5,
        },
        {
          mark: 'rectY',
          data: {from: tableName, filterBy: '$brush'},
          x: {bin: field, maxbins: 25},
          y: {count: null},
          fill: FG_COLOR,
          inset: 0.5,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: null,
      yAxis: null,
      height: 200,
      width: 380,
      margins: {left: 0, right: 10, top: 10, bottom: 30},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};

export const histogramChartType: ChartTypeDefinition = {
  id: 'histogram',
  label: 'Histogram',
  description: 'Create a histogram of a field',
  aiDescription:
    'Use for the distribution of one numeric or temporal column with count on the y-axis.',
  fields: [
    {
      key: 'field',
      label: 'Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description: 'Numeric or temporal column to bin into histogram buckets.',
    },
  ],
  buildTitle: titleFromDescription('Create a histogram of a field'),
  createSpec: (tableName, {field}): Spec =>
    ({
      plot: [
        {
          mark: 'rectY',
          data: {from: tableName},
          x: {bin: field, maxbins: 40},
          y: {count: null},
          fill: BG_COLOR,
          inset: 0.5,
        },
        {
          mark: 'rectY',
          data: {from: tableName, filterBy: '$brush'},
          x: {bin: field, maxbins: 40},
          y: {count: null},
          fill: FG_COLOR,
          inset: 0.5,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: 'Count',
      height: 200,
      width: 380,
      margins: {left: 40, right: 10, top: 10, bottom: 30},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};

export const lineChartChartType: ChartTypeDefinition = {
  id: 'line-chart',
  label: 'Line Chart',
  description: 'Create a line chart of two fields',
  aiDescription:
    'Use for trends over an ordered x-axis, typically time on x and a numeric measure on y.',
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
      key: 'y',
      label: 'Y Field',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric measure plotted on the y-axis.',
    },
  ],
  buildTitle: titleFromDescription('Create a line chart of two fields'),
  createSpec: (tableName, {x, y}): Spec =>
    ({
      plot: [
        {
          mark: 'lineY',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          stroke: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 10, top: 10, bottom: 30},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};

export const ecdfChartType: ChartTypeDefinition = {
  id: 'ecdf',
  label: 'eCDF',
  description: 'Create an eCDF chart of a field',
  aiDescription:
    'Use for a cumulative distribution curve over one numeric or temporal column.',
  fields: [
    {
      key: 'field',
      label: 'Field',
      required: true,
      types: [...QUANTITATIVE_COLUMN_TYPES],
      description:
        'Numeric or temporal column used to build the cumulative distribution.',
    },
  ],
  buildTitle: titleFromDescription('Create an eCDF chart of a field'),
  createSpec: (tableName, {field}): Spec =>
    ({
      plot: [
        {
          mark: 'areaY',
          data: {from: tableName, filterBy: '$brush'},
          x: field,
          y: {cumulative: field},
          fill: FG_COLOR,
          fillOpacity: 0.3,
        },
        {
          mark: 'lineY',
          data: {from: tableName, filterBy: '$brush'},
          x: field,
          y: {cumulative: field},
          stroke: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: field,
      yLabel: 'Cumulative',
      height: 250,
      width: 380,
      margins: {left: 50, right: 10, top: 10, bottom: 30},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};

export const heatmapChartType: ChartTypeDefinition = {
  id: 'heatmap',
  label: 'Heatmap',
  description: 'Create a 2D heatmap of two fields',
  aiDescription:
    'Use for dense relationships between two numeric columns where point overlap would be high.',
  fields: [
    {
      key: 'x',
      label: 'X Field',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric column used on the x-axis.',
    },
    {
      key: 'y',
      label: 'Y Field',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric column used on the y-axis.',
    },
  ],
  buildTitle: titleFromDescription('Create a 2D heatmap of two fields'),
  createSpec: (tableName, {x, y}): Spec =>
    ({
      plot: [
        {
          mark: 'raster',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          fill: 'density',
          bandwidth: 0,
          pixelSize: 3,
        },
        {select: 'intervalXY', as: '$brush'},
      ],
      colorScale: 'sqrt',
      colorScheme: 'ylorrd',
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 40, right: 10, top: 15, bottom: 30},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};

export const boxPlotChartType: ChartTypeDefinition = {
  id: 'box-plot',
  label: 'Box Plot',
  description: 'Create a box plot',
  aiDescription:
    'Use for comparing the distribution of a numeric measure across categories.',
  fields: [
    {
      key: 'x',
      label: 'X Field (categorical)',
      required: true,
      description: 'Grouping field that defines the categories.',
    },
    {
      key: 'y',
      label: 'Y Field (numeric)',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric measure summarized within each category.',
    },
  ],
  buildTitle: titleFromDescription('Create a box plot'),
  createSpec: (tableName, {x, y}): Spec =>
    ({
      plot: [
        {
          mark: 'boxY',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          fill: FG_COLOR,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 10, top: 10, bottom: 30},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};

export const bubbleChartChartType: ChartTypeDefinition = {
  id: 'bubble-chart',
  label: 'Bubble Chart',
  description: 'Create a bubble chart',
  aiDescription: 'Use for a simple scatterplot of two numeric columns.',
  fields: [
    {
      key: 'x',
      label: 'X Field',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric column used on the x-axis.',
    },
    {
      key: 'y',
      label: 'Y Field',
      required: true,
      types: [...NUMERIC_COLUMN_TYPES],
      description: 'Numeric column used on the y-axis.',
    },
  ],
  buildTitle: titleFromDescription('Create a bubble chart'),
  createSpec: (tableName, {x, y}): Spec =>
    ({
      plot: [
        {
          mark: 'dot',
          data: {from: tableName, filterBy: '$brush'},
          x,
          y,
          fill: FG_COLOR,
          fillOpacity: 0.5,
          r: 3,
        },
        {select: 'intervalXY', as: '$brush'},
      ],
      xLabel: x,
      yLabel: y,
      height: 250,
      width: 380,
      margins: {left: 50, right: 10, top: 10, bottom: 30},
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};

export const customSpecChartType: ChartTypeDefinition = {
  id: 'custom-spec',
  label: 'Custom Spec',
  description: 'Create a chart with custom spec',
  aiDescription:
    'Manual template for editing after creation. Prefer explicit chart templates for assistant-created charts.',
  fields: [],
  buildTitle: titleFromDescription('Create a chart with custom spec'),
  createSpec: (tableName): Spec =>
    ({
      plot: [
        {
          mark: 'rectY',
          data: {from: tableName, filterBy: '$brush'},
          x: {bin: 'field_name', maxbins: 25},
          y: {count: null},
          fill: 'steelblue',
          inset: 0.5,
        },
        {select: 'intervalX', as: '$brush'},
      ],
      xLabel: 'field_name',
      height: 200,
      width: 380,
      params: {brush: {select: 'crossfilter'}},
    }) as Spec,
};

export const mosaicChartTypes = {
  countPlot: countPlotChartType,
  histogram: histogramChartType,
  lineChart: lineChartChartType,
  ecdf: ecdfChartType,
  heatmap: heatmapChartType,
  boxPlot: boxPlotChartType,
  bubbleChart: bubbleChartChartType,
  customSpec: customSpecChartType,
} as const;

export function createDefaultChartTypes(options?: {
  includeCustomSpec?: boolean;
}): ChartTypeDefinition[] {
  const includeCustomSpec = options?.includeCustomSpec ?? true;
  const chartTypes: ChartTypeDefinition[] = [
    countPlotChartType,
    histogramChartType,
    lineChartChartType,
    ecdfChartType,
    heatmapChartType,
    boxPlotChartType,
    bubbleChartChartType,
  ];

  if (includeCustomSpec) {
    chartTypes.push(customSpecChartType);
  }

  return chartTypes;
}
