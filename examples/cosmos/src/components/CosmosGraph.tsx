import {Graph, GraphConfigInterface} from '@cosmograph/cosmos';
import {FC, useEffect, useRef} from 'react';

type CosmosGraphProps = {
  config: GraphConfigInterface;
  pointPositions: Float32Array;
  pointSizes: Float32Array;
  pointColors: Float32Array;
};

export const CosmosGraph: FC<CosmosGraphProps> = ({
  config,
  pointPositions,
  pointSizes,
  pointColors,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!graphRef.current) {
      graphRef.current = new Graph(containerRef.current);
    }

    const graph = graphRef.current;
    graph.setPointPositions(pointPositions);
    graph.setPointColors(pointColors);
    graph.setPointSizes(pointSizes);
    graph.setConfig(config);
    graph.render();

    graph.setZoomLevel(0.6);

    console.log(graph);
  }, [pointPositions, pointColors, pointSizes, config]);

  return <div ref={containerRef} className="w-full h-full" />;
};
