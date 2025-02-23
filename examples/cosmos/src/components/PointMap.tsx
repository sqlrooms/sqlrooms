import {GraphConfigInterface} from '@cosmograph/cosmos';
import {useDuckDbQuery} from '@sqlrooms/duckdb';
import {FC, useMemo} from 'react';
import {useProjectStore} from '../store';
import {CosmosGraph} from './CosmosGraph';
export const PointMap: FC = () => {
  const isTableReady = useProjectStore((state) =>
    Boolean(state.project.tables.find((t) => t.tableName === 'publications')),
  );

  const {data: queryResult} = useDuckDbQuery<{
    x: number;
    y: number;
    title: string;
    publishedOn: string;
    numCitations: string;
    mainField: string;
  }>({
    query: `
      FROM publications
      SELECT
        x, y, title, 
        strftime(pub_date, '%B %d, %Y') AS publishedOn,
        n_cits::varchar AS numCitations,
        main_field AS mainField
    `,
    enabled: isTableReady,
  });

  const graphData = useMemo(() => {
    if (!queryResult) return null;

    const pointPositions = new Float32Array(queryResult.length * 2);
    const pointSizes = new Float32Array(queryResult.length);
    const pointColors = new Float32Array(queryResult.length * 4);

    for (let i = 0; i < queryResult.length; i++) {
      const point = queryResult.getRow(i);
      pointPositions[i * 2] = point.x;
      pointPositions[i * 2 + 1] = point.y;
      pointSizes[i] = 1;
      pointColors[i * 4] = 1;
      pointColors[i * 4 + 1] = 0.25;
      pointColors[i * 4 + 2] = 0.75;
      pointColors[i * 4 + 3] = 0.5;
    }

    return {
      pointPositions,
      pointSizes,
      pointColors,
    };
  }, [queryResult]);

  const config = useMemo<GraphConfigInterface>(
    () => ({
      backgroundColor: 'transparent',
      fitViewOnInit: true,
      enableDrag: false,
      disableSimulation: true,
      pointSizeScale: 5,
      scalePointsOnZoom: true,
    }),
    [],
  );

  return graphData ? (
    <CosmosGraph
      config={config}
      pointPositions={graphData.pointPositions}
      pointSizes={graphData.pointSizes}
      pointColors={graphData.pointColors}
      getPointTooltip={(index) => {
        if (!queryResult) return null;
        const row = queryResult.getRow(index);
        return (
          <div className="flex flex-col gap-1 text-xs">
            <div className="text-xs font-medium text-gray-100 mb-1.5">
              {row.title}
            </div>
            <div className="text-gray-400">Topic: {row.mainField}</div>
            <div className="text-gray-400">Published: {row.publishedOn}</div>
            <div className="text-gray-400">Citations: {row.numCitations}</div>
          </div>
        );
      }}
    />
  ) : null;
};
