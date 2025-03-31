import {z} from 'zod';

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
