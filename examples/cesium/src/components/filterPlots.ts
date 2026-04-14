import type {Spec} from '@sqlrooms/mosaic';
import {AIRLINE_COLOR_DOMAIN, AIRLINE_COLOR_RANGE} from '../airlinePalette';

const BG_COLOR = '#d8dee8';
const FG_COLOR = '#ec7f5f';

export interface ChartConfig {
  id: string;
  title: string;
  spec: Spec;
}

function categoryBarSpec(field: string, limit = 14): Spec {
  return {
    plot: [
      {
        mark: 'barX',
        data: {from: 'opensky_nyc_chart_points'},
        x: {count: null},
        y: field,
        fill: BG_COLOR,
        sort: {
          y: '-x',
          limit,
        },
      },
      {
        mark: 'barX',
        data: {from: 'opensky_nyc_chart_points', filterBy: '$brush'},
        x: {count: null},
        y: field,
        fill: FG_COLOR,
        sort: {
          y: '-x',
          limit,
        },
      },
      {select: 'toggleY', as: '$brush'},
      {select: 'toggleY', as: '$highlight'},
      {select: 'highlight', by: '$highlight', opacity: 0.35},
    ],
    xLabel: 'Flights',
    yLabel: null,
    width: 380,
    height: 190,
    margins: {left: 72, right: 16, top: 12, bottom: 28},
    params: {brush: {select: 'crossfilter'}},
  } as Spec;
}

export const departureAirportChart: ChartConfig = {
  id: 'departure-airport',
  title: 'Departure Airport',
  spec: categoryBarSpec('departure_airport'),
};

export const arrivalAirportChart: ChartConfig = {
  id: 'arrival-airport',
  title: 'Arrival Airport',
  spec: categoryBarSpec('arrival_airport'),
};

export const airlineCodeChart: ChartConfig = {
  id: 'airline-code',
  title: 'Airline Code',
  spec: {
    plot: [
      {
        mark: 'barX',
        data: {from: 'opensky_nyc_chart_points'},
        x: {count: null},
        y: 'airline_code',
        fill: 'airline_code',
        fillOpacity: 0.28,
        sort: {
          y: '-x',
          limit: 14,
        },
      },
      {
        mark: 'barX',
        data: {from: 'opensky_nyc_chart_points', filterBy: '$brush'},
        x: {count: null},
        y: 'airline_code',
        fill: 'airline_code',
        sort: {
          y: '-x',
          limit: 14,
        },
      },
      {select: 'toggleY', as: '$brush'},
      {select: 'toggleY', as: '$highlight'},
      {select: 'highlight', by: '$highlight', opacity: 0.35},
    ],
    xLabel: 'Flights',
    yLabel: null,
    width: 380,
    height: 190,
    margins: {left: 72, right: 16, top: 12, bottom: 28},
    colorDomain: AIRLINE_COLOR_DOMAIN,
    colorRange: AIRLINE_COLOR_RANGE,
    params: {brush: {select: 'crossfilter'}},
  } as Spec,
};

export const defaultChartConfigs: ChartConfig[] = [
  departureAirportChart,
  arrivalAirportChart,
  airlineCodeChart,
];
