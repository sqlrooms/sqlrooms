import {z} from 'zod';
import {DataSource} from './DataSource';
import {DEFAULT_MOSAIC_LAYOUT, LayoutConfig} from '@sqlrooms/layout-config';

export const DEFAULT_ROOM_TITLE = 'Untitled room';

export const BaseRoomConfig = z
  .object({
    title: z.string().default(DEFAULT_ROOM_TITLE).describe('Room title.'),
    description: z.string().nullable().optional().describe('Room description.'),
    layout: LayoutConfig.default(DEFAULT_MOSAIC_LAYOUT).describe(
      'Layout specifies how views are arranged on the screen.',
    ),
    dataSources: z
      .array(DataSource)
      .default([])
      .describe('Data sources. Each data source must have a unique tableName.'),
  })
  .describe('Room configuration.');

export type BaseRoomConfig = z.infer<typeof BaseRoomConfig>;

export function createDefaultBaseRoomConfig(): BaseRoomConfig {
  return {
    title: DEFAULT_ROOM_TITLE,
    layout: DEFAULT_MOSAIC_LAYOUT,
    dataSources: [],
  };
}
