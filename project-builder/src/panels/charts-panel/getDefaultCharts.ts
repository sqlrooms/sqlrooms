import {ChartConfig} from '@sqlrooms/project-config';

export const getDefaultCharts = (
  preparedDataSchema: string,
  // columnMapping: FlowmapColumnMapping,
  flowsFilterClause = 'TRUE',
): ChartConfig[] => {
  // const {flows, locations} = columnMapping;

  // const locName = escapeId(locations.columns.name ?? locId);
  // const flowOrigin = escapeId(flows.columns.origin);
  // const flowDest = escapeId(flows.columns.dest);
  // const flowCount = flows.columns.count ? escapeId(flows.columns.count) : '1';
  const locationsTable = `${preparedDataSchema}.locations`;
  const flowsTable = `${preparedDataSchema}.flows`;
  const locId = 'id';
  const locName = 'name';
  const flowOrigin = 'origin';
  const flowDest = 'dest';
  const flowCount = 'count';

  return [
    {
      type: 'vgplot',
      title: 'Top origins',
      description: 'Top 10 origins by total trips',
      spec: {
        data: {
          top_10_origins: `
            SELECT 
              l.${locName}::varchar AS origin_name, 
              SUM(${flowCount})::int AS total_trips 
            FROM ${flowsTable} f
            LEFT JOIN ${locationsTable} l 
              ON f.${flowOrigin}::varchar = l.${locId}::varchar
            WHERE f.${flowOrigin} != f.${flowDest} AND ${flowsFilterClause}
            GROUP BY origin_name
            ORDER BY total_trips DESC
            LIMIT 10`,
        },
        plot: [
          {
            mark: 'barX',
            data: {from: 'top_10_origins'},
            x: 'total_trips',
            y: 'origin_name',
            fill: 'steelblue',
            tip: true,
            sort: {y: '-x'},
          },
          {
            mark: 'axisY',
            label: null,
          },
          {
            mark: 'axisX',
            label: null,
          },
        ],
        height: 400,
        marginLeft: 200,
        style: {
          fontSize: '17px',
        },
      },
    },
    {
      type: 'vgplot',
      title: 'Top destinations',
      description: 'Top 10 destinations by total trips',
      spec: {
        data: {
          top_10_dests: `
            SELECT 
              l.${locName}::varchar AS dest_name, 
              SUM(${flowCount})::int AS total_trips 
            FROM ${flowsTable} f
            LEFT JOIN ${locationsTable} l 
              ON f.${flowDest}::varchar = l.${locId}::varchar
            WHERE f.${flowOrigin} != f.${flowDest} AND ${flowsFilterClause}
            GROUP BY dest_name
            ORDER BY total_trips DESC
            LIMIT 10`,
        },
        plot: [
          {
            mark: 'barX',
            data: {from: 'top_10_dests'},
            x: 'total_trips',
            y: 'dest_name',
            tip: true,
            fill: 'steelblue',
            sort: {y: '-x'},
          },
          {
            mark: 'axisY',
            label: null,
          },
          {
            mark: 'axisX',
            label: null,
          },
        ],
        height: 400,
        marginLeft: 200,
        style: {
          fontSize: '17px',
        },
      },
    },
    // {
    //   type: 'vgplot',
    //   title: 'Flow count distribution',
    //   spec: {
    //     data: {
    //       flows_non_internal: `
    //         SELECT
    //           ${flowCount}::int AS count
    //         FROM ${flowsTable} f
    //         WHERE f.${flowOrigin} != f.${flowDest}`,
    //     },
    //     plot: [
    //       {
    //         mark: 'rectY',
    //         data: {
    //           from: 'flows_non_internal',
    //           // filterBy: '$brush',
    //         },
    //         x: {
    //           bin: 'count',
    //         },
    //         y: {
    //           // count: null,
    //           sum: 'count',
    //         },
    //         tip: true,
    //         fill: 'steelblue',
    //         inset: 0.5,
    //       },
    //       // {
    //       //   select: 'intervalX',
    //       //   as: '$brush',
    //       // },
    //     ],
    //     xDomain: 'Fixed',
    //     xScale: 'linear',
    //     marginLeft: 75,
    //     style: {
    //       background: '#000',
    //     },
    //   },
    // },
  ];
};
