import {z} from 'zod';
import {CosmosSimulationConfigSchema} from './config';

export const CosmosSliceConfig = z.object({
  cosmos: z.object({
    isSimulationRunning: z.boolean().default(true),
    simulationConfig: CosmosSimulationConfigSchema.default({
      simulationGravity: 0.25,
      simulationRepulsion: 1.0,
      simulationLinkSpring: 1.0,
      simulationLinkDistance: 10,
      simulationFriction: 0.85,
      simulationDecay: 1000,
    }),
  }),
});

export type CosmosSliceConfig = z.infer<typeof CosmosSliceConfig>;

export function createDefaultCosmosConfig(): CosmosSliceConfig {
  return {
    cosmos: {
      isSimulationRunning: true,
      simulationConfig: {
        simulationGravity: 0.25,
        simulationRepulsion: 1.0,
        simulationLinkSpring: 1.0,
        simulationLinkDistance: 10,
        simulationFriction: 0.85,
        simulationDecay: 1000,
      },
    },
  };
}
