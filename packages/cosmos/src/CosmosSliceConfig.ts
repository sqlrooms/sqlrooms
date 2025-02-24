import {z} from 'zod';
import {CosmosSimulationConfigSchema} from './config';

const DEFAULT_COSMOS_CONFIG: CosmosSliceConfig['cosmos'] = {
  pointSizeScale: 1.1,
  showHoveredPointLabel: true,
  showLabels: true,
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
} as const;

export const CosmosPointAppearanceConfigSchema = z.object({
  pointSizeScale: z.number().describe('Scale factor for point sizes'),
  showHoveredPointLabel: z
    .boolean()
    .describe('Display label when hovering over a point'),
  showLabels: z.boolean().describe('Display labels (except hovered)'),
  scalePointsOnZoom: z
    .boolean()
    .describe('Dynamically resize points based on zoom level'),
});
export type CosmosPointAppearanceConfigSchema = z.infer<
  typeof CosmosPointAppearanceConfigSchema
>;

export const CosmosLinkAppearanceConfigSchema = z.object({
  renderLinks: z.boolean().describe('Control links displaying'),
  linkWidthScale: z.number().describe('Scale factor for link width'),
  linkArrowsSizeScale: z.number().describe('Scale factor for link arrows size'),
  linkArrows: z.boolean().describe('Control displaying link direction arrows'),
  curvedLinks: z
    .boolean()
    .describe('Render links as curved bezier paths instead of straight lines'),
});
export type CosmosLinkAppearanceConfigSchema = z.infer<
  typeof CosmosLinkAppearanceConfigSchema
>;

export const CosmosSliceConfig = z.object({
  cosmos: z
    .object({
      // TODO: add custom props
      // isSimulationRunning: z.boolean().default(true),
    })
    .merge(CosmosPointAppearanceConfigSchema)
    .merge(CosmosLinkAppearanceConfigSchema)
    .merge(CosmosSimulationConfigSchema),
});
export type CosmosSliceConfig = z.infer<typeof CosmosSliceConfig>;

export function createDefaultCosmosConfig(): CosmosSliceConfig {
  return {
    cosmos: DEFAULT_COSMOS_CONFIG,
  };
}
