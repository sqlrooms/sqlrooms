import {Graph, GraphConfigInterface} from '@cosmograph/cosmos';
import {useEffect, useRef} from 'react';

/**
 * A custom hook that manages the lifecycle and state of a Cosmos graph instance.
 *
 * This hook handles:
 * - Graph initialization and cleanup
 * - Point and link data updates
 * - Configuration changes
 * - Focus state management
 *
 * The graph is automatically initialized when the container is ready and cleaned up
 * when the component unmounts. It also responds to changes in data and configuration
 * by updating the graph accordingly.
 *
 * @example
 * ```tsx
 * const GraphComponent = () => {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const config = {
 *     backgroundColor: '#ffffff',
 *     nodeSize: 5,
 *   };
 *
 *   const graphRef = useGraph(
 *     containerRef,
 *     config,
 *     new Float32Array([0, 0, 1, 1]), // x,y coordinates for 2 points
 *     new Float32Array([1, 0, 0, 1]), // RGBA colors for 2 points
 *     new Float32Array([5, 5]), // sizes for 2 points
 *     new Float32Array([0, 1]), // link between points 0 and 1
 *     new Float32Array([0, 0, 0, 1]), // RGBA color for the link
 *   );
 *
 *   return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
 * };
 * ```
 *
 * @param containerRef - Reference to the DOM element that will contain the graph
 * @param config - Graph configuration object defining visual and behavioral properties
 * @param pointPositions - Float32Array containing x,y coordinates for each point (2 values per point)
 * @param pointColors - Float32Array containing RGBA values for each point (4 values per point)
 * @param pointSizes - Float32Array containing size values for each point (1 value per point)
 * @param linkIndexes - Optional Float32Array containing pairs of point indices defining links
 * @param linkColors - Optional Float32Array containing RGBA values for each link (4 values per link)
 * @param focusedPointIndex - Optional index of the point to focus on
 * @returns A ref containing the Graph instance
 */
export const useGraph = (
  containerRef: React.RefObject<HTMLDivElement>,
  config: GraphConfigInterface,
  pointPositions: Float32Array,
  pointColors: Float32Array,
  pointSizes: Float32Array,
  linkIndexes?: Float32Array,
  linkColors?: Float32Array,
  focusedPointIndex?: number,
) => {
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

    if (linkIndexes && linkColors) {
      graph.setLinks(linkIndexes);
      graph.setLinkColors(linkColors);
    }

    graph.setConfig(config);
    graph.render();
    graph.start();

    graph.setZoomLevel(0.6);

    return () => {
      graph.pause();
    };
  }, [
    containerRef,
    pointPositions,
    pointColors,
    pointSizes,
    linkIndexes,
    linkColors,
    config,
  ]);

  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.setConfig(config);
  }, [config]);

  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.setFocusedPointByIndex(focusedPointIndex);
  }, [focusedPointIndex]);

  return graphRef;
};
