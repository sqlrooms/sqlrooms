/**
 * React hooks for managing Cosmos graph state and interactions
 *
 * This module exports several hooks that help manage different aspects of a Cosmos graph:
 *
 * - `useGraph`: Core hook for managing the graph instance and its lifecycle
 * - `useHoverState`: Hook for managing point hover state and coordinates
 * - `useGraphConfig`: Hook for creating a memoized graph configuration with event handlers
 *
 * @example Using multiple hooks together
 * ```tsx
 * const MyGraph = () => {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const calcRelativeCoords = useRelativeCoordinates(containerRef);
 *
 *   const { hoveredPoint, onPointMouseOver } = useHoverState(calcRelativeCoords);
 *   const config = useGraphConfig(baseConfig, onPointMouseOver, clearHoverState);
 *   const graphRef = useGraph(containerRef, config, positions, colors, sizes);
 *
 *   return <div ref={containerRef} />;
 * };
 * ```
 *
 * @packageDocumentation
 */

export * from './useGraph';
export * from './useHoverState';
export * from './useGraphConfig';
