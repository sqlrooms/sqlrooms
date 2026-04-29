import {MAIN_VIEW} from '@sqlrooms/room-shell';
import {z} from 'zod';

export const RoomPanelTypes = z.enum([
  'schema',
  'data',
  'console',
  'results',
  'dashboards',
  'bottom',
  'left',
  MAIN_VIEW,
] as const);

export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;
