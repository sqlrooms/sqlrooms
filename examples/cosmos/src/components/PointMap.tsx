import {getDuckDb} from '@sqlrooms/duckdb';
import {useProjectStore} from '../store';
import {CosmosGraph} from './CosmosGraph';
import {useQuery} from '@tanstack/react-query';
import {FC, useMemo} from 'react';
import {GraphConfigInterface} from '@cosmograph/cosmos';

export const PointMap: FC = () => {
  const isTableReady = useProjectStore((state) =>
    Boolean(state.project.tables.find((t) => t.tableName === 'publications')),
  );

  const {data} = useQuery({
    queryKey: ['publications'],
    queryFn: async () => {
      const duckDb = await getDuckDb();
      const result = await duckDb.conn.query('SELECT x,y FROM publications');
      const pointPositions = new Float32Array(result.numRows * 2);
      const pointSizes = new Float32Array(result.numRows);
      const pointColors = new Float32Array(result.numRows * 4);
      for (let i = 0; i < result.numRows; i++) {
        pointPositions[i * 2] = result.getChild('x')?.at(i);
        pointPositions[i * 2 + 1] = result.getChild('y')?.at(i);
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
    },
    enabled: isTableReady,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const config = useMemo<GraphConfigInterface>(
    () => ({
      backgroundColor: 'transparent',
      fitViewOnInit: true,
      enableDrag: false,
      disableSimulation: true,
      pointSizeScale: 5,
      onPointMouseOver: (point) => {
        console.log(point);
      },
    }),
    [],
  );

  return data ? (
    <CosmosGraph
      config={config}
      pointPositions={data.pointPositions}
      pointSizes={data.pointSizes}
      pointColors={data.pointColors}
    />
  ) : null;
};
