import {GraphConfigInterface} from '@cosmograph/cosmos';
import {useMemo} from 'react';

/**
 * A custom hook that creates a memoized graph configuration by combining base config with hover handlers.
 *
 * This hook merges the provided base configuration with hover-related event handlers while preserving
 * all the original simulation lifecycle callbacks. It ensures that hover states are properly cleared
 * when certain graph interactions (zoom, drag) begin.
 *
 * @example
 * ```tsx
 * const Graph = () => {
 *   const baseConfig = {
 *     backgroundColor: '#ffffff',
 *     nodeSize: 5,
 *     onSimulationStart: () => console.log('Simulation started'),
 *   };
 *
 *   const { hoveredPoint, onPointMouseOver, clearHoverState } = useHoverState(calcRelativeCoords);
 *   const config = useGraphConfig(baseConfig, onPointMouseOver, clearHoverState);
 *
 *   return <CosmosGraph config={config} />;
 * };
 * ```
 *
 * @param baseConfig - The base graph configuration containing visual and behavioral settings
 * @param onPointMouseOver - Handler function called when a point is hovered
 * @param clearHoverState - Handler function to clear the current hover state
 * @returns A memoized graph configuration that combines base settings with hover functionality
 */
export const useGraphConfig = (
  baseConfig: GraphConfigInterface,
  onPointMouseOver: GraphConfigInterface['onPointMouseOver'],
  clearHoverState: GraphConfigInterface['onPointMouseOut'],
) => {
  return useMemo(() => {
    return {
      ...baseConfig,
      onSimulationStart: () => {
        baseConfig.onSimulationStart?.();
      },
      onSimulationPause: () => {
        baseConfig.onSimulationPause?.();
      },
      onSimulationEnd: () => {
        baseConfig.onSimulationEnd?.();
      },
      onSimulationRestart: () => {
        baseConfig.onSimulationRestart?.();
      },
      onPointMouseOver,
      onPointMouseOut: clearHoverState,
      onZoomStart: clearHoverState,
      onDragStart: clearHoverState,
    } satisfies GraphConfigInterface;
  }, [baseConfig, onPointMouseOver, clearHoverState]);
};
