import {getDuckDb} from '@sqlrooms/duckdb';
import {useProjectStore} from '../store';
import {CosmosGraph} from './CosmosGraph';
import {useQuery} from '@tanstack/react-query';
import {FC, useMemo} from 'react';
import {GraphConfigInterface} from '@cosmograph/cosmos';

export const MammalsGraph: FC = () => {
  const isTableReady = useProjectStore((state) =>
    Boolean(state.project.tables.find((t) => t.tableName === 'mammals')),
  );

  const {data} = useQuery({
    queryKey: ['mammals'],
    queryFn: async () => {
      console.log('queryFn mammals');
      const duckDb = await getDuckDb();
      // Query both nodes and edges from the mammals table
      const result = await duckDb.conn.query(`
        SELECT source, target FROM mammals
      `);

      // Create arrays for nodes and links
      const uniqueNodes = new Set<number>();
      const edges: {source: number; target: number}[] = [];

      // Process results to build graph data
      for (let i = 0; i < result.numRows; i++) {
        const sourceId = result.getChild('source')?.at(i);
        const targetId = result.getChild('target')?.at(i);
        uniqueNodes.add(sourceId);
        uniqueNodes.add(targetId);
        edges.push({source: sourceId, target: targetId});
      }

      const nodes = Array.from(uniqueNodes);

      // Create position arrays for visualization
      const pointPositions = new Float32Array(nodes.length * 2);
      const pointSizes = new Float32Array(nodes.length);
      const pointColors = new Float32Array(nodes.length * 4);
      const linkIndexes = new Float32Array(edges.length * 2);
      const linkColors = new Float32Array(edges.length * 4);

      // Set node properties
      nodes.forEach((node, i) => {
        pointPositions[i * 2] = 0; // x
        pointPositions[i * 2 + 1] = 0; // y
        pointSizes[i] = 2;
        pointColors[i * 4] = 0.2; // R
        pointColors[i * 4 + 1] = 0.6; // G
        pointColors[i * 4 + 2] = 1.0; // B
        pointColors[i * 4 + 3] = 1.0; // A
      });

      // Set edge properties
      edges.forEach((edge, i) => {
        linkIndexes[i * 2] = nodes.indexOf(edge.source);
        linkIndexes[i * 2 + 1] = nodes.indexOf(edge.target);
        linkColors[i * 4] = 0.5; // R
        linkColors[i * 4 + 1] = 0.5; // G
        linkColors[i * 4 + 2] = 0.8; // B
        linkColors[i * 4 + 3] = 0.3; // A
      });

      return {
        pointPositions,
        pointSizes,
        pointColors,
        linkIndexes,
        linkColors,
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
      linkWidth: 1,
      linkColor: '#5F74C2',
      linkArrows: false,
      fitViewOnInit: true,
      fitViewDelay: 5000,
      simulationGravity: 0.1,
      simulationLinkDistance: 1,
      simulationLinkSpring: 0.3,
      simulationRepulsion: 0.4,
      pointSizeScale: 1.5,
      scalePointsOnZoom: false,
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
      linkIndexes={data.linkIndexes}
      linkColors={data.linkColors}
    />
  ) : null;
};
