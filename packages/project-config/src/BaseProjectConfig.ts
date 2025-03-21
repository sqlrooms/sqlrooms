import {z} from 'zod';
import LayoutConfig, {DEFAULT_MOSAIC_LAYOUT} from './LayoutConfig';

export const DEFAULT_PROJECT_TITLE = 'Untitled project';

export const DataSourceTypes = z.enum(['file', 'url', 'sql']);
export type DataSourceTypes = z.infer<typeof DataSourceTypes>;

export const BaseDataSource = z.object({
  type: DataSourceTypes,
  tableName: z
    .string()
    .describe(
      'Unique table name used to store the data loaded from the data source.',
    ),
});
export type BaseDataSource = z.infer<typeof BaseDataSource>;

export const FileDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.file),
  fileName: z
    .string()
    .describe('Currently only CSV and Parquet files are supported.'),
});
export type FileDataSource = z.infer<typeof FileDataSource>;

export const UrlDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.url),
  url: z
    .string()
    .describe(
      'URL to fetch data from. Currently only CSV and Parquet files are supported.',
    ),
});
export type UrlDataSource = z.infer<typeof UrlDataSource>;

export const SqlQueryDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.sql),
  sqlQuery: z.string().describe('SQL query to execute.'),
});
export type SqlQueryDataSource = z.infer<typeof SqlQueryDataSource>;

export const DataSource = z
  .discriminatedUnion('type', [
    FileDataSource,
    UrlDataSource,
    SqlQueryDataSource,
  ])
  .describe('Data source specification.');
export type DataSource = z.infer<typeof DataSource>;

export const BaseProjectConfig = z
  .object({
    title: z.string().default(DEFAULT_PROJECT_TITLE).describe('Project title.'),
    description: z.string().optional().describe('Project description.'),
    dataSources: z
      .array(DataSource)
      .default([])
      .describe('Data sources. Each data source must have a unique tableName.'),
    layout: LayoutConfig.default(DEFAULT_MOSAIC_LAYOUT).describe(
      'Layout specifies how views are arranged on the screen.',
    ),
  })
  .describe('Project configuration.');
export type BaseProjectConfig = z.infer<typeof BaseProjectConfig>;
