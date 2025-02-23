import {useDuckDbQuery} from '@sqlrooms/duckdb';
import {useProjectStore} from '../store';
import {CosmosGraph} from './CosmosGraph';
import {FC, useMemo} from 'react';
import {GraphConfigInterface} from '@cosmograph/cosmos';

export const PointMap: FC = () => {
  const isTableReady = useProjectStore((state) =>
    Boolean(state.project.tables.find((t) => t.tableName === 'publications')),
  );

  const {data: queryResult} = useDuckDbQuery<{x: number; y: number}>({
    query: 'SELECT x,y FROM publications',
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
      scalePointsOnZoom: false,
      onPointMouseOver: (point) => {
        console.log(point);
      },
    }),
    [],
  );

  return graphData ? (
    <CosmosGraph
      config={config}
      pointPositions={graphData.pointPositions}
      pointSizes={graphData.pointSizes}
      pointColors={graphData.pointColors}
    />
  ) : null;
};
