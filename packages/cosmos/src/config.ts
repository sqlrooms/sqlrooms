import {z} from 'zod';
import {GraphConfigInterface} from '@cosmograph/cosmos';

export const DEFAULT_COSMOS_CONFIG_SIMULATION = {
  simulationGravity: 0.25,
  simulationRepulsion: 1.0,
  simulationLinkSpring: 1,
  simulationLinkDistance: 10,
  simulationFriction: 0.85,
  simulationDecay: 1000,
} satisfies Partial<GraphConfigInterface>;

export const CosmosSimulationConfigSchema = z.object({
  simulationGravity: z
    .number()
    .default(DEFAULT_COSMOS_CONFIG_SIMULATION.simulationGravity)
    .describe('Gravity force in the simulation'),

  simulationRepulsion: z
    .number()
    .default(DEFAULT_COSMOS_CONFIG_SIMULATION.simulationRepulsion)
    .describe('Repulsion force between nodes'),

  simulationLinkSpring: z
    .number()
    .default(DEFAULT_COSMOS_CONFIG_SIMULATION.simulationLinkSpring)
    .describe('Spring force for links between nodes'),

  simulationLinkDistance: z
    .number()
    .default(DEFAULT_COSMOS_CONFIG_SIMULATION.simulationLinkDistance)
    .describe('Target distance between linked nodes'),

  simulationFriction: z
    .number()
    .default(DEFAULT_COSMOS_CONFIG_SIMULATION.simulationFriction)
    .describe('Friction coefficient in the simulation'),

  simulationDecay: z
    .number()
    .default(DEFAULT_COSMOS_CONFIG_SIMULATION.simulationDecay)
    .describe('Decay coefficient in the simulation'),
} satisfies Partial<Record<keyof GraphConfigInterface, unknown>>);
