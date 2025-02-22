import {getDuckDb} from '@sqlrooms/duckdb';
import {useProjectStore} from '../store';
import {CosmosGraph} from './CosmosGraph';
import {useQuery} from '@tanstack/react-query';
import {FC, useMemo} from 'react';
import {GraphConfigInterface} from '@cosmograph/cosmos';

export const MainView: FC = () => {
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
  });
  const config = useMemo<GraphConfigInterface>(
    () => ({
      backgroundColor: '#151515',
      // linkWidth: 0.1,
      // linkColor: '#5F74C2',
      // linkArrows: false,
      fitViewOnInit: true,
      enableDrag: false,
      disableSimulation: true,
      // simulationGravity: 0.1,
      // simulationLinkDistance: 1,
      // simulationLinkSpring: 0.3,
      // simulationRepulsion: 0.4,
      pointSizeScale: 5,
      onPointMouseOver: (point) => {
        console.log(point);
      },
      // onSimulationTick: () => graph && cosmosLabels.update(graph),
      // onZoom: () => graph && cosmosLabels.update(graph),
    }),
    [],
  ); // Empty deps array since config is static
  return data ? (
    <CosmosGraph
      config={config}
      pointPositions={data.pointPositions}
      pointSizes={data.pointSizes}
      pointColors={data.pointColors}
    />
  ) : null;
};
