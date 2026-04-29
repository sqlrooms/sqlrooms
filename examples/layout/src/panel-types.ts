import {z} from 'zod';

export const RoomPanelTypes = z.enum([
  'schema',
  'data',
  'console',
  'results',
  'dashboards',
  'bottom',
  'left',
  'main',
] as const);

export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;
