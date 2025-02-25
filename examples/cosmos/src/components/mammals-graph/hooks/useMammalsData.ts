import {useDuckDbQuery} from '@sqlrooms/duckdb';
import {useProjectStore} from '../../../store';
import {useMemo} from 'react';

interface Edge {
  source: string;
  target: string;
}

export const useMammalsData = () => {
  const isTableReady = useProjectStore((state) =>
    Boolean(state.project.tables.find((t) => t.tableName === 'mammals')),
  );

  const {data: queryResult} = useDuckDbQuery<Edge>({
    query: 'SELECT source, target FROM mammals',
    enabled: isTableReady,
  });

  const graphData = useMemo(() => {
    if (!queryResult) return null;

    // Create arrays for nodes and links
    const uniqueNodes = new Set<string>();

    // Process results to build graph data
    for (let i = 0; i < queryResult.length; i++) {
      const edge = queryResult.getRow(i);
      uniqueNodes.add(edge.source);
      uniqueNodes.add(edge.target);
    }

    const nodes = Array.from(uniqueNodes);

    // Create position arrays for visualization
    const pointPositions = new Float32Array(nodes.length * 2);
    const pointSizes = new Float32Array(nodes.length);
    const pointColors = new Float32Array(nodes.length * 4);
    const linkIndexes = new Float32Array(queryResult.length * 2);
    const linkColors = new Float32Array(queryResult.length * 4);

    // Set node properties
    nodes.forEach((_node, i) => {
      pointPositions[i * 2] = 0; // x
      pointPositions[i * 2 + 1] = 0; // y
      pointSizes[i] = 2;
      pointColors[i * 4] = 0.2; // R
      pointColors[i * 4 + 1] = 0.6; // G
      pointColors[i * 4 + 2] = 1.0; // B
      pointColors[i * 4 + 3] = 1.0; // A
    });

    // Set edge properties
    for (let i = 0; i < queryResult.length; i++) {
      const edge = queryResult.getRow(i);
      linkIndexes[i * 2] = nodes.indexOf(edge.source);
      linkIndexes[i * 2 + 1] = nodes.indexOf(edge.target);
      linkColors[i * 4] = 0.5; // R
      linkColors[i * 4 + 1] = 0.5; // G
      linkColors[i * 4 + 2] = 0.8; // B
      linkColors[i * 4 + 3] = 0.3; // A
    }

    return {
      pointPositions,
      pointSizes,
      pointColors,
      linkIndexes,
      linkColors,
      nodes: Array.from(uniqueNodes),
    };
  }, [queryResult]);

  return {
    graphData,
  };
};
