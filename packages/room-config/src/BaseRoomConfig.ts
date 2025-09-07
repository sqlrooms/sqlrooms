import {LayoutConfig} from '@sqlrooms/layout-config';
import {z} from 'zod';
import {DataSource} from './DataSource';

export const DEFAULT_ROOM_TITLE = 'Untitled';

export const BaseRoomConfig = z
  .object({
    title: z.string().describe('Room title.').optional(),
    description: z.string().nullable().optional().describe('Room description.'),
    layout: LayoutConfig.describe(
      'Layout specifies how views are arranged on the screen.',
    ).optional(),
    dataSources: z
      .array(DataSource)
      .describe('Data sources. Each data source must have a unique tableName.')
      .optional(),
  })
  .describe('Room configuration.');

export type BaseRoomConfig = z.infer<typeof BaseRoomConfig>;
