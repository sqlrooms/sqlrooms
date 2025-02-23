import {z} from 'zod';
import {GraphConfigInterface} from '@cosmograph/cosmos';

export const CosmosSimulationConfigSchema = z.object({
  simulationGravity: z.number().describe('Gravity force in the simulation'),

  simulationRepulsion: z.number().describe('Repulsion force between nodes'),

  simulationLinkSpring: z
    .number()
    .describe('Spring force for links between nodes'),

  simulationLinkDistance: z
    .number()
    .describe('Target distance between linked nodes'),

  simulationFriction: z
    .number()
    .describe('Friction coefficient in the simulation'),

  simulationDecay: z
    .number()
    .describe(
      'Decay coefficient in the simulation. Use smaller values if you want the simulation to "cool down" slower.',
    ),
});
