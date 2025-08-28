import {useRelativeCoordinates} from '@sqlrooms/ui';
import {useState, useCallback, useMemo} from 'react';
import {hasClientCoordinates} from '../utils/coordinates';
import {GraphConfigInterface} from '@cosmograph/cosmos';

/**
 * Represents the state of a hovered point in the graph.
 * When a point is hovered, contains its index and position coordinates.
 * When no point is hovered, the state is null.
 */
export type HoverState = {
  /** The index of the hovered point in the graph data array */
  index: number;
  /** The [x, y] coordinates of the hovered point relative to the container */
  position: [number, number];
} | null;

/**
 * A custom hook that manages hover state for graph points.
 *
 * This hook provides functionality to:
 * - Track which point is currently being hovered
 * - Store the hover position coordinates
 * - Clear the hover state
 * - Provide event handlers for hover-related graph interactions
 *
 * @example
 * ```tsx
 * const Graph = () => {
 *   const calcRelativeCoords = useRelativeCoordinates(containerRef);
 *   const { hoveredPoint, eventHandlers } = useHoverState(calcRelativeCoords);
 *
 *   return (
 *     <div ref={containerRef}>
 *       <CosmosGraph
 *         config={eventHandlers}
 *       />
 *       {hoveredPoint && (
 *         <Tooltip
 *           x={hoveredPoint.position[0]}
 *           y={hoveredPoint.position[1]}
 *         />
 *       )}
 *     </div>
 *   );
 * };
 * ```
 *
 * @param calcRelativeCoordinates - A function that converts client coordinates to container-relative coordinates
 * @returns An object containing the hover state and event handlers for the graph
 */
export const useHoverState = (
  calcRelativeCoordinates: ReturnType<typeof useRelativeCoordinates>,
) => {
  const [hoveredPoint, setHoveredPoint] = useState<HoverState>(null);

  const onPointMouseOver = useCallback<
    Required<GraphConfigInterface>['onPointMouseOver']
  >(
    (index, _pointPosition, event) => {
      if (hasClientCoordinates(event)) {
        setHoveredPoint({
          index,
          position: calcRelativeCoordinates(event.clientX, event.clientY),
        });
      }
    },
    [calcRelativeCoordinates],
  );

  const clearHoverState = useCallback(() => setHoveredPoint(null), []);

  const eventHandlers = useMemo(
    () => ({
      onPointMouseOver,
      onPointMouseOut: clearHoverState,
      onZoomStart: clearHoverState,
      onDragStart: clearHoverState,
    }),
    [onPointMouseOver, clearHoverState],
  );

  return {
    /** The current hover state, containing the index and position of the hovered point, or null if no point is hovered */
    hoveredPoint,
    /** Event handlers for hover-related graph interactions */
    eventHandlers,
  };
};
