import {Spec, VgPlotChart, useMosaic} from '@sqlrooms/mosaic';
import {SpinnerPane} from '@sqlrooms/ui';
import {useProjectStore} from '../store';
export const MainView = () => {
  const {isMosaicLoading} = useMosaic();

  const isTableReady = useProjectStore((state) =>
    state.db.tables.find((t) => t.tableName === 'latency'),
  );

  if (isMosaicLoading) {
    return <SpinnerPane className="h-full w-full" />;
  }
  if (!isTableReady) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
        No data available
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 p-4">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">{chartSpec?.meta?.title}</h1>
        <p className="whitespace-pre-line text-sm text-gray-400">
          {chartSpec?.meta?.description}
        </p>
        <p className="mt-2 text-sm italic text-gray-500">
          {chartSpec?.meta?.credit?.replace(/\[(.*?)\]\((.*?)\)/, '$1')}
        </p>
      </div>

      <VgPlotChart spec={chartSpec} />
    </div>
  );
};

const chartSpec: Spec = {
  meta: {
    title: 'Observable Website Latency',
    description:
      'Web request latency on Observable.com.\nEach pixel in the heatmap shows the most common route (URL pattern) at a given response latency within a time interval.\nUse the bar chart of most-requested routes to filter the heatmap and isolate specific patterns.\nOr, select a range in the heatmap to show the corresponding most-requested routes.',
    credit:
      'Adapted from a Mosaic Framework example: https://idl.uw.edu/mosaic/examples/observable-latency.html',
  },
  data: {
    latency: {
      type: 'table',
      query: 'SELECT * FROM latency',
    },
  },
  params: {
    filter: {
      select: 'crossfilter',
    },
  },
  vconcat: [
    {
      plot: [
        {
          mark: 'frame',
          fill: 'black',
        },
        {
          mark: 'raster',
          data: {
            from: 'latency',
            filterBy: '$filter',
          },
          x: 'time',
          y: 'latency',
          fill: {
            argmax: ['route', 'count'],
          },
          fillOpacity: {
            sum: 'count',
          },
          width: 2016,
          height: 500,
          imageRendering: 'pixelated',
        },
        {
          select: 'intervalXY',
          as: '$filter',
        },
      ],
      colorDomain: 'Fixed',
      colorScheme: 'observable10',
      opacityDomain: [0, 25],
      opacityClamp: true,
      yScale: 'log',
      yLabel: '↑ Duration (ms)',
      yDomain: [0.5, 10000],
      yTickFormat: 's',
      xScale: 'utc',
      xLabel: null,
      xDomain: [1706227200000, 1706832000000],
      width: 680,
      height: 300,
      margins: {
        left: 35,
        top: 20,
        bottom: 30,
        right: 20,
      },
    },
    {
      plot: [
        {
          mark: 'barX',
          data: {
            from: 'latency',
            filterBy: '$filter',
          },
          x: {
            sum: 'count',
          },
          y: 'route',
          fill: 'route',
          sort: {
            y: '-x',
            limit: 15,
          },
        },
        {
          select: 'toggleY',
          as: '$filter',
        },
        {
          select: 'toggleY',
          as: '$highlight',
        },
        {
          select: 'highlight',
          by: '$highlight',
        },
      ],
      colorDomain: 'Fixed',
      xLabel: 'Routes by Total Requests',
      xTickFormat: 's',
      yLabel: null,
      width: 680,
      height: 300,
      marginTop: 5,
      marginLeft: 220,
      marginBottom: 35,
    },
  ],
};
