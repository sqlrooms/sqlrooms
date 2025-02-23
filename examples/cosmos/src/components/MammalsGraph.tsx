import {GraphConfigInterface} from '@cosmograph/cosmos';
import {useDuckDbQuery} from '@sqlrooms/duckdb';
import {FC, useMemo, useState} from 'react';
import {useProjectStore} from '../store';
import {CosmosGraph} from './CosmosGraph';

export const MammalsGraph: FC = () => {
  const isTableReady = useProjectStore((state) =>
    Boolean(state.project.tables.find((t) => t.tableName === 'mammals')),
  );

  const {data: queryResult} = useDuckDbQuery<{source: string; target: string}>({
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

  const [focusedPointIndex, setFocusedPointIndex] = useState<
    number | undefined
  >(undefined);

  const config = useMemo<GraphConfigInterface>(
    () => ({
      backgroundColor: 'transparent',
      enableDrag: true, // allow dragging the nodes
      linkWidth: 1,
      linkColor: '#5F74C2',
      linkArrows: false,
      fitViewOnInit: true,
      fitViewDelay: 5000,
      simulationGravity: 0.1,
      simulationLinkDistance: 1,
      simulationLinkSpring: 0.3,
      simulationRepulsion: 0.4,
      pointSizeScale: 1,
      scalePointsOnZoom: true,
      renderHoveredPointRing: true,
      hoveredPointRingColor: '#a33aef',
      renderFocusedPointRing: true,
      focusedPointRingColor: '#ee55ff',
      onClick: (index) => {
        console.log(index);
        if (index === undefined) {
          setFocusedPointIndex(undefined);
        } else {
          setFocusedPointIndex(index);
        }
      },
    }),
    [],
  );

  return graphData ? (
    <CosmosGraph
      config={config}
      focusedPointIndex={focusedPointIndex}
      pointPositions={graphData.pointPositions}
      pointSizes={graphData.pointSizes}
      pointColors={graphData.pointColors}
      linkIndexes={graphData.linkIndexes}
      linkColors={graphData.linkColors}
      getPointTooltip={(index) => String(graphData.nodes[index])}
    />
  ) : null;
};
