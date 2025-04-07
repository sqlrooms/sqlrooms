import {LoadFileOptions} from './LoadOptions';
import {z} from 'zod';

/**
 * Enum representing the supported types of data sources
 * @enum {string}
 */
export const DataSourceTypes = z.enum(['file', 'url', 'sql']);
export type DataSourceTypes = z.infer<typeof DataSourceTypes>;

/**
 * Base interface for all data source configurations
 * @interface BaseDataSource
 */
export const BaseDataSource = z.object({
  /** Type of the data source */
  type: DataSourceTypes,
  /**
   * Unique table name used to store the data loaded from the data source.
   * This name will be used to reference the data in SQL queries.
   */
  tableName: z
    .string()
    .describe(
      'Unique table name used to store the data loaded from the data source.',
    ),
});
export type BaseDataSource = z.infer<typeof BaseDataSource>;

/**
 * Configuration for file-based data sources
 * @interface FileDataSource
 * @extends {BaseDataSource}
 */
export const FileDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.file),
  /** Path to the data file */
  fileName: z
    .string()
    .describe('Currently only CSV and Parquet files are supported.'),
  /** Optional configuration for file loading */
  loadOptions: LoadFileOptions.optional(),
});
export type FileDataSource = z.infer<typeof FileDataSource>;

/**
 * Configuration for URL-based data sources
 * @interface UrlDataSource
 * @extends {BaseDataSource}
 */
export const UrlDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.url),
  /** URL from which to fetch the data */
  url: z
    .string()
    .describe(
      'URL to fetch data from. Currently only CSV and Parquet files are supported.',
    ),
  /** Optional configuration for file loading */
  loadOptions: LoadFileOptions.optional().describe(
    'Options for loading the file.',
  ),
  /** Optional HTTP method to use for the request */
  method: z.string().optional().describe('HTTP method to use for the request.'),
  /** Optional headers to include in the request */
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe('Headers to include in the request.'),
});
export type UrlDataSource = z.infer<typeof UrlDataSource>;

/**
 * Configuration for SQL query-based data sources
 * @interface SqlQueryDataSource
 * @extends {BaseDataSource}
 */
export const SqlQueryDataSource = BaseDataSource.extend({
  type: z.literal(DataSourceTypes.enum.sql),
  /** SQL query to execute for data retrieval */
  sqlQuery: z.string().describe('SQL query to execute.'),
});
export type SqlQueryDataSource = z.infer<typeof SqlQueryDataSource>;

/**
 * Union type representing all possible data source configurations
 * Discriminated union based on the 'type' field
 * @type {DataSource}
 */
export const DataSource = z
  .discriminatedUnion('type', [
    FileDataSource,
    UrlDataSource,
    SqlQueryDataSource,
  ])
  .describe('Data source specification.');
export type DataSource = z.infer<typeof DataSource>;
