import {z} from 'zod';
import {DataSource} from './DataSource';
import LayoutConfig, {DEFAULT_MOSAIC_LAYOUT} from './LayoutConfig';

export const DEFAULT_PROJECT_TITLE = 'Untitled project';

export const BaseProjectConfig = z
  .object({
    title: z.string().default(DEFAULT_PROJECT_TITLE).describe('Project title.'),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('Project description.'),
    layout: LayoutConfig.default(DEFAULT_MOSAIC_LAYOUT).describe(
      'Layout specifies how views are arranged on the screen.',
    ),
    dataSources: z
      .array(DataSource)
      .default([])
      .describe('Data sources. Each data source must have a unique tableName.'),
  })
  .describe('Project configuration.');

export type BaseProjectConfig = z.infer<typeof BaseProjectConfig>;
