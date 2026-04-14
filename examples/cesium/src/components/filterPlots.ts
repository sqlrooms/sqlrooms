import type {Spec} from '@sqlrooms/mosaic';

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
  spec: categoryBarSpec('airline_code'),
};

export const defaultChartConfigs: ChartConfig[] = [
  departureAirportChart,
  arrivalAirportChart,
  airlineCodeChart,
];
