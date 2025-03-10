import {GraphConfigInterface} from '@cosmograph/cosmos';
import {cn, useRelativeCoordinates} from '@sqlrooms/ui';
import {FC, useEffect, useRef} from 'react';
import {useStoreWithCosmos} from './CosmosSlice';
import {useHoverState} from './hooks/useHoverState';

/**
 * Props for the CosmosGraph component.
 */
export type CosmosGraphProps = {
  /** Configuration object for the graph's visual and behavioral properties */
  config: GraphConfigInterface;
  /** Float32Array containing x,y coordinates for each point (2 values per point) */
  pointPositions: Float32Array;
  /** Float32Array containing size values for each point (1 value per point) */
  pointSizes: Float32Array;
  /** Float32Array containing RGBA values for each point (4 values per point) */
  pointColors: Float32Array;
  /** Optional Float32Array containing pairs of point indices defining links */
  linkIndexes?: Float32Array;
  /** Optional Float32Array containing RGBA values for each link (4 values per link) */
  linkColors?: Float32Array;
  /** Optional index of the point to focus on */
  focusedPointIndex?: number | undefined;
  /** Optional function to render custom tooltip content for a point */
  renderPointTooltip?: (index: number) => React.ReactNode;
  /** Optional child elements to render inside the graph container */
  children?: React.ReactNode;
};

/**
 * A React component that renders an interactive graph visualization using Cosmos.
 *
 * Features:
 * - Renders points and optional links in a WebGL canvas
 * - Supports point hovering with customizable tooltips
 * - Handles point focusing
 * - Provides graph state to child components through zustand store
 *
 * @example
 * ```tsx
 * const MyGraph = () => {
 *   const config = {
 *     backgroundColor: '#ffffff',
 *     nodeSize: 5,
 *     simulation: {
 *       repulsion: 0.5,
 *       gravity: 0.1,
 *     },
 *   };
 *
 *   return (
 *     <div style={{ width: '800px', height: '600px' }}>
 *       <CosmosGraph
 *         config={config}
 *         pointPositions={new Float32Array([0, 0, 1, 1])}
 *         pointColors={new Float32Array([1, 0, 0, 1, 0, 1, 0, 1])}
 *         pointSizes={new Float32Array([5, 5])}
 *         renderPointTooltip={(index) => `Point ${index}`}
 *       >
 *         <GraphControls />
 *       </CosmosGraph>
 *     </div>
 *   );
 * };
 * ```
 */
export const CosmosGraph: FC<CosmosGraphProps> = ({
  config,
  pointPositions,
  pointSizes,
  pointColors,
  linkIndexes,
  linkColors,
  focusedPointIndex,
  renderPointTooltip,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const calcRelativeCoordinates = useRelativeCoordinates(containerRef);
  const {hoveredPoint, eventHandlers} = useHoverState(calcRelativeCoordinates);
  const createGraph = useStoreWithCosmos((s) => s.cosmos.createGraph);
  const destroyGraph = useStoreWithCosmos((s) => s.cosmos.destroyGraph);
  const updateGraphConfig = useStoreWithCosmos(
    (s) => s.cosmos.updateGraphConfig,
  );
  const updateGraphData = useStoreWithCosmos((s) => s.cosmos.updateGraphData);
  const setFocusedPoint = useStoreWithCosmos((s) => s.cosmos.setFocusedPoint);

  // Create graph instance and clean up on unmount
  useEffect(() => {
    if (!containerRef.current) return;
    createGraph(containerRef.current);
    return () => destroyGraph();
  }, [createGraph, destroyGraph]);

  // Update graph config when it changes
  useEffect(() => {
    updateGraphConfig({
      ...config,
      ...eventHandlers,
    });
  }, [config, eventHandlers, updateGraphConfig]);

  // Update graph data when props change
  useEffect(() => {
    updateGraphData({
      pointPositions,
      pointColors,
      pointSizes,
      linkIndexes,
      linkColors,
    });
  }, [
    updateGraphData,
    pointPositions,
    pointColors,
    pointSizes,
    linkIndexes,
    linkColors,
  ]);

  // Update focus when it changes
  useEffect(() => {
    setFocusedPoint(focusedPointIndex);
  }, [setFocusedPoint, focusedPointIndex]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute h-full w-full" />
      {renderPointTooltip ? (
        <div
          className={cn(
            'absolute z-50 max-w-xs',
            'rounded-md bg-white/90 p-2 shadow-lg dark:bg-gray-800/90',
            'pointer-events-none flex items-center gap-2 text-xs transition-opacity duration-150',
            hoveredPoint ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            transform: `translate(${hoveredPoint?.position?.[0] ?? 0}px, ${
              hoveredPoint?.position?.[1] ?? 0
            }px) translate(-50%, 5px)`,
            visibility: hoveredPoint ? 'visible' : 'hidden',
          }}
        >
          <div>{renderPointTooltip?.(hoveredPoint?.index ?? 0)}</div>
        </div>
      ) : null}
      {children}
    </div>
  );
};
