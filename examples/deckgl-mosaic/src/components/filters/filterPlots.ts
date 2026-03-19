import {Spec} from '@sqlrooms/mosaic';

const backgroundColor = '#f5d9a6';
const foregroundColor = '#e67f5f';

export interface ChartConfig {
  id: string;
  title: string;
  spec: Spec;
}

export const magChartConfig: ChartConfig = {
  id: 'magnitude',
  title: 'Distribution by Magnitude',
  spec: {
    plot: [
      {
        mark: 'rectY',
        data: {from: 'earthquakes'},
        x: {bin: 'Magnitude', maxbins: 25},
        y: {count: null},
        fill: backgroundColor,
        inset: 0.5,
      },
      {
        mark: 'rectY',
        data: {from: 'earthquakes', filterBy: '$brush'},
        x: {bin: 'Magnitude', maxbins: 25},
        y: {count: null},
        fill: foregroundColor,
        inset: 0.5,
      },
      {select: 'intervalX', as: '$brush'},
    ],
    xLabel: 'Magnitude (Richter)',
    yLabel: null,
    yAxis: null,
    height: 180,
    width: 380,
    margins: {left: 0, right: 10, top: 10, bottom: 30},
    params: {brush: {select: 'crossfilter'}},
  } as Spec,
};

export const timeChartConfig: ChartConfig = {
  id: 'timeline',
  title: 'Temporal Frequency',
  spec: {
    plot: [
      {
        mark: 'rectY',
        data: {from: 'earthquakes'},
        x: {bin: 'DateTime', maxbins: 40},
        y: {count: null},
        fill: backgroundColor,
        inset: 0.5,
      },
      {
        mark: 'rectY',
        data: {from: 'earthquakes', filterBy: '$brush'},
        x: {bin: 'DateTime', maxbins: 40},
        y: {count: null},
        fill: foregroundColor,
        inset: 0.5,
      },
      {select: 'intervalX', as: '$brush'},
    ],
    xLabel: 'Year',
    yLabel: null,
    yAxis: null,
    height: 180,
    width: 380,
    // Negative left margin offsets the hidden y-axis (yAxis: null) so bin bars align flush
    margins: {left: -15, right: 15, top: 10, bottom: 30},
    params: {brush: {select: 'crossfilter'}},
  } as Spec,
};

export const depthChartConfig: ChartConfig = {
  id: 'depth',
  title: 'Depth vs Magnitude',
  spec: {
    plot: [
      {
        mark: 'raster',
        data: {from: 'earthquakes', filterBy: '$brush'},
        x: 'Magnitude',
        y: 'Depth',
        fill: 'density',
        bandwidth: 0,
        pixelSize: 3,
      },
      {select: 'intervalXY', as: '$brush'},
    ],
    colorScale: 'sqrt',
    colorScheme: 'ylorrd',
    yReverse: true,
    xLabel: 'Magnitude',
    yLabel: 'Depth (km)',
    height: 250,
    width: 380,
    margins: {left: 24, right: 10, top: 15, bottom: 30},
    params: {brush: {select: 'crossfilter'}},
  } as Spec,
};

export const defaultChartConfigs: ChartConfig[] = [
  magChartConfig,
  timeChartConfig,
  depthChartConfig,
];
