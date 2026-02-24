import {z} from 'zod';

/**
 * Enum representing supported file loading methods
 * @enum {string}
 */
export const LoadFile = z.enum([
  'read_json', // Read JSON files
  'read_ndjson', // Read NDJSON (Newline Delimited JSON) files
  'read_parquet', // Read Parquet files
  'read_csv', // Read CSV files
  'auto', // Auto-detect file format
  'st_read', // Read spatial data files
]);
export type LoadFile = z.infer<typeof LoadFile>;

/**
 * Standard options for loading data files
 * @interface StandardLoadOptions
 */
export const StandardLoadOptions = z
  .object({
    /** Schema to load the table into */
    schema: z.string().optional(),
    /** Columns to select, defaults to ['*'] */
    select: z.array(z.string()).optional(),
    /** WHERE clause filter condition */
    where: z.string().optional(),
    /** Whether to create as a view */
    view: z.boolean().optional(),
    /** Whether to create as a temporary table */
    temp: z.boolean().optional(),
    /** Whether to replace existing table */
    replace: z.boolean().optional(),
  })
  // The catchall allows for additional file-specific options that vary by file format:
  // - CSV: delimiter, header, quote, escape, etc.
  // - JSON: format, auto_detect, etc.
  // - Parquet: specific parquet options
  // These are passed through to the underlying DuckDB read functions
  .catchall(z.unknown());
export type StandardLoadOptions = z.infer<typeof StandardLoadOptions>;

/**
 * Extended options specifically for spatial data loading
 * Includes all standard options plus spatial-specific parameters
 * @interface SpatialLoadOptions
 * @extends {StandardLoadOptions}
 */
export const SpatialLoadOptions = StandardLoadOptions.extend({
  /** Additional options for spatial data loading */
  options: z
    .union([z.array(z.string()), z.string(), z.record(z.string(), z.unknown())])
    .optional(),
});
export type SpatialLoadOptions = z.infer<typeof SpatialLoadOptions>;

/**
 * Options specific to spatial file loading with st_read method
 * @interface SpatialLoadFileOptions
 * @extends {SpatialLoadOptions}
 */
export const SpatialLoadFileOptions = SpatialLoadOptions.extend({
  method: z.literal('st_read'),
});
export type SpatialLoadFileOptions = z.infer<typeof SpatialLoadFileOptions>;

/**
 * Type guard to check if options are spatial load file options
 * @param {LoadFileOptions} options - The options to check
 * @returns {boolean} True if options are spatial load file options
 */
export const isSpatialLoadFileOptions = (
  options: LoadFileOptions,
): options is SpatialLoadFileOptions => {
  return options.method === 'st_read';
};

/**
 * Standard file loading options excluding spatial methods
 * @interface StandardLoadFileOptions
 * @extends {StandardLoadOptions}
 */
export const StandardLoadFileOptions = StandardLoadOptions.extend({
  method: LoadFile.exclude(['st_read']),
});
export type StandardLoadFileOptions = z.infer<typeof StandardLoadFileOptions>;

/**
 * Union type of all possible file loading options
 * Discriminated union based on the 'method' field
 */
export const LoadFileOptions = z.discriminatedUnion('method', [
  StandardLoadFileOptions,
  SpatialLoadFileOptions,
]);
export type LoadFileOptions = z.infer<typeof LoadFileOptions>;
