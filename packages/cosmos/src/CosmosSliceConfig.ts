import {z} from 'zod';
import {GraphConfigInterface} from '@cosmograph/cosmos';

/**
 * Default configuration values for the Cosmos graph visualization.
 * These values provide a balanced starting point for most graph visualizations.
 */
const DEFAULT_COSMOS_CONFIG: CosmosSliceConfig['cosmos'] = {
  pointSizeScale: 1.1,
  scalePointsOnZoom: true,
  simulationGravity: 0.25,
  simulationRepulsion: 1.0,
  simulationLinkSpring: 1.0,
  simulationLinkDistance: 10,
  simulationFriction: 0.85,
  simulationDecay: 1000,
  renderLinks: true,
  linkArrows: false,
  curvedLinks: false,
  linkWidthScale: 1,
  linkArrowsSizeScale: 1,
} as const satisfies Partial<GraphConfigInterface>;

/**
 * Zod schema for validating and configuring the Cosmos graph visualization.
 * This schema defines all available configuration options and their types.
 *
 * The configuration is divided into several categories:
 *
 * Node Appearance:
 * - `pointSizeScale`: Controls the size of nodes
 * - `scalePointsOnZoom`: Enables dynamic node sizing based on zoom level
 *
 * Link Appearance:
 * - `renderLinks`: Toggles link visibility
 * - `linkWidthScale`: Controls link thickness
 * - `linkArrows`: Toggles directional arrows
 * - `linkArrowsSizeScale`: Controls arrow size
 * - `curvedLinks`: Toggles curved/straight links
 *
 * Physics Simulation:
 * - `simulationGravity`: Central gravitational force (0.25)
 * - `simulationRepulsion`: Node repulsion force (1.0)
 * - `simulationLinkSpring`: Link spring force (1.0)
 * - `simulationLinkDistance`: Natural link length (10)
 * - `simulationFriction`: Movement damping (0.85)
 * - `simulationDecay`: Simulation cooling rate (1000)
 *
 * @example Basic configuration
 * ```typescript
 * const config: CosmosSliceConfig = {
 *   cosmos: {
 *     pointSizeScale: 1.2,
 *     scalePointsOnZoom: true,
 *     renderLinks: true,
 *     linkWidthScale: 1.5,
 *     simulationGravity: 0.25
 *   }
 * };
 * ```
 *
 * @example Directed graph with curved links
 * ```typescript
 * const directedGraphConfig: CosmosSliceConfig = {
 *   cosmos: {
 *     linkArrows: true,
 *     linkArrowsSizeScale: 1.2,
 *     curvedLinks: true,
 *     simulationLinkDistance: 15,
 *     simulationLinkSpring: 1.2
 *   }
 * };
 * ```
 *
 * @example High-performance configuration for large graphs
 * ```typescript
 * const largeGraphConfig: CosmosSliceConfig = {
 *   cosmos: {
 *     simulationGravity: 0.1,
 *     simulationRepulsion: 0.8,
 *     simulationFriction: 0.9,
 *     simulationDecay: 2000,
 *     scalePointsOnZoom: false
 *   }
 * };
 * ```
 */
export const CosmosSliceConfig = z.object({
  cosmos: z.object({
    /**
     * Scale factor for point (node) sizes in the graph.
     * Values > 1 make nodes larger, values < 1 make them smaller.
     * @default 1.1
     */
    pointSizeScale: z.number().describe('Scale factor for point sizes'),

    /**
     * When true, nodes will dynamically resize based on the current zoom level.
     * This helps maintain visual clarity at different zoom levels.
     * @default true
     */
    scalePointsOnZoom: z
      .boolean()
      .describe('Dynamically resize points based on zoom level'),

    /**
     * Controls whether links (edges) between nodes are displayed.
     * @default true
     */
    renderLinks: z.boolean().describe('Control links displaying'),

    /**
     * Scale factor for link (edge) width.
     * Values > 1 make links thicker, values < 1 make them thinner.
     * @default 1
     */
    linkWidthScale: z.number().describe('Scale factor for link width'),

    /**
     * Scale factor for the size of directional arrows on links.
     * Only applies when linkArrows is true.
     * @default 1
     */
    linkArrowsSizeScale: z
      .number()
      .describe('Scale factor for link arrows size'),

    /**
     * When true, displays arrows indicating link direction.
     * Useful for directed graphs.
     * @default false
     */
    linkArrows: z
      .boolean()
      .describe('Control displaying link direction arrows'),

    /**
     * When true, links are rendered as curved Bezier paths.
     * When false, links are straight lines.
     * @default false
     */
    curvedLinks: z
      .boolean()
      .describe(
        'Render links as curved bezier paths instead of straight lines',
      ),

    /**
     * Controls the strength of the central gravitational force.
     * Higher values pull nodes more strongly toward the center.
     * @default 0.25
     */
    simulationGravity: z.number().describe('Gravity force in the simulation'),

    /**
     * Controls how strongly nodes repel each other.
     * Higher values create more space between unconnected nodes.
     * @default 1.0
     */
    simulationRepulsion: z.number().describe('Repulsion force between nodes'),

    /**
     * Controls the strength of the spring force between linked nodes.
     * Higher values pull connected nodes more tightly together.
     * @default 1.0
     */
    simulationLinkSpring: z
      .number()
      .describe('Spring force for links between nodes'),

    /**
     * The natural or resting length of links between nodes.
     * Higher values create more spacing between connected nodes.
     * @default 10
     */
    simulationLinkDistance: z
      .number()
      .describe('Target distance between linked nodes'),

    /**
     * Controls how quickly node movement decays.
     * Higher values (closer to 1) create more damped movement.
     * @default 0.85
     */
    simulationFriction: z
      .number()
      .describe('Friction coefficient in the simulation'),

    /**
     * Controls how quickly the simulation stabilizes.
     * Lower values result in longer, smoother transitions.
     * @default 1000
     */
    simulationDecay: z
      .number()
      .describe(
        'Decay coefficient in the simulation. Use smaller values if you want the simulation to "cool down" slower.',
      ),
  } satisfies Partial<Record<keyof GraphConfigInterface, unknown>>),
});
export type CosmosSliceConfig = z.infer<typeof CosmosSliceConfig>;

export function createDefaultCosmosConfig(): CosmosSliceConfig {
  return {
    cosmos: DEFAULT_COSMOS_CONFIG,
  };
}
