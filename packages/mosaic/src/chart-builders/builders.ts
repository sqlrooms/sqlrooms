import {Spec} from '@uwdata/mosaic-spec';
import {
  AlignHorizontalDistributeCenter,
  BarChart3,
  BarChartHorizontal,
  BubblesIcon,
  Code,
  Grid3X3,
  LineChart,
  TrendingUp,
} from 'lucide-react';
import {MosaicChartBuilder} from './types';

const BG_COLOR = '#f5d9a6';
const FG_COLOR = '#e67f5f';

/**
 * Creates a count plot (bar chart with counts) of a field
 */
const countPlotBuilder: MosaicChartBuilder = {
  id: 'count-plot',
  icon: BarChartHorizontal,
  description: 'Create a count plot of a field',
  fields: [{key: 'field', label: 'Field', required: true}],
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

/**
 * Creates a histogram with background/filtered overlay
 */
const histogramBuilder: MosaicChartBuilder = {
  id: 'histogram',
  icon: BarChart3,
  description: 'Create a histogram of a field',
  fields: [{key: 'field', label: 'Field', required: true}],
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

/**
 * Creates a line chart of two fields
 */
const lineChartBuilder: MosaicChartBuilder = {
  id: 'line-chart',
  icon: LineChart,
  description: 'Create a line chart of two fields',
  fields: [
    {key: 'x', label: 'X Field', required: true},
    {key: 'y', label: 'Y Field', required: true},
  ],
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

/**
 * Creates an empirical cumulative distribution (eCDF) chart
 */
const ecdfBuilder: MosaicChartBuilder = {
  id: 'ecdf',
  icon: TrendingUp,
  description: 'Create an eCDF chart of a field',
  fields: [{key: 'field', label: 'Field', required: true}],
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

/**
 * Creates a 2D heatmap of two fields
 */
const heatmapBuilder: MosaicChartBuilder = {
  id: 'heatmap',
  icon: Grid3X3,
  description: 'Create a 2D heatmap of two fields',
  fields: [
    {key: 'x', label: 'X Field', required: true},
    {key: 'y', label: 'Y Field', required: true},
  ],
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

/**
 * Creates a box plot
 */
const boxPlotBuilder: MosaicChartBuilder = {
  id: 'box-plot',
  icon: AlignHorizontalDistributeCenter,
  description: 'Create a box plot',
  fields: [
    {key: 'x', label: 'X Field (categorical)', required: true},
    {key: 'y', label: 'Y Field (numeric)', required: true},
  ],
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

/**
 * Creates a bubble chart
 */
const bubbleChartBuilder: MosaicChartBuilder = {
  id: 'bubble-chart',
  icon: BubblesIcon,
  description: 'Create a bubble chart',
  fields: [
    {key: 'x', label: 'X Field', required: true},
    {key: 'y', label: 'Y Field', required: true},
  ],
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

/**
 * Creates a chart with custom spec (empty template)
 */
const customSpecBuilder: MosaicChartBuilder = {
  id: 'custom-spec',
  icon: Code,
  description: 'Create a chart with custom spec',
  fields: [],
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

/**
 * Creates the default set of chart builders.
 * Call this to get a fresh array that you can extend or filter.
 */
export function createDefaultChartBuilders(): MosaicChartBuilder[] {
  return [
    countPlotBuilder,
    histogramBuilder,
    lineChartBuilder,
    ecdfBuilder,
    heatmapBuilder,
    boxPlotBuilder,
    bubbleChartBuilder,
    customSpecBuilder,
  ];
}
