import {z} from 'zod';
import {DEFAULT_PROJECT_TITLE} from './common';
import {FlowmapViewConfig} from './FlowmapViewConfig';
import LayoutConfig, {DEFAULT_MOSAIC_LAYOUT} from './LayoutConfig';

/*
1. No database uuids should be used in the map config types
only unique names
2. It's probably ok to save optional fields as undefined
*/

export const DataSourceTypes = z.enum([
  'file',
  'url',
  'sql',
  /*, 'gsheets', */
]);
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

export const ChartTypes = z.enum(['vgplot']);
export type ChartTypes = z.infer<typeof ChartTypes>;

export const VgPlotSpec = z
  .intersection(
    z.object({
      style: z.record(z.unknown()).optional(),
    }),
    z.record(z.unknown()),
  )
  .describe(
    'Mosaic vgplot specification for a chart. See https://uwdata.github.io/mosaic/vgplot/',
  );
export type VgPlotSpec = z.infer<typeof VgPlotSpec>;

export const VgPlotChartConfig = z.object({
  // id: z.string(),
  type: z.literal(ChartTypes.enum.vgplot).describe('Chart type.'),
  title: z.string().optional().describe('Chart title.'),
  description: z.string().optional().describe('Chart description.'),
  spec: VgPlotSpec.describe(VgPlotSpec._def.description ?? 'Chart spec.'),
});
export type VgPlotChartConfig = z.infer<typeof VgPlotChartConfig>;

export const ChartConfig = z
  .discriminatedUnion('type', [VgPlotChartConfig])
  .describe('Chart configuration.');
export type ChartConfig = z.infer<typeof ChartConfig>;

export const ViewConfig = z
  .discriminatedUnion('type', [FlowmapViewConfig])
  .describe('View configuration.');
export type ViewConfig = z.infer<typeof ViewConfig>;

export const ProjectConfig = z
  .object({
    version: z.literal(1).default(1).describe('Config version, currently 1.'),
    title: z.string().default(DEFAULT_PROJECT_TITLE).describe('Project title.'),
    description: z.string().optional().describe('Project description.'),
    dataSources: z
      .array(DataSource)
      .default([])
      .describe('Data sources. Each data source must have a unique tableName.'),
    views: z
      .array(ViewConfig)
      .default([])
      .describe(
        'Views are data representations or various configuration panels.',
      ),
    charts: z.array(ChartConfig).optional(),
    layout: LayoutConfig.default(DEFAULT_MOSAIC_LAYOUT).describe(
      'Layout specifies how views are arranged on the screen.',
    ),
  })
  .describe('Project configuration.');

export type ProjectConfig = z.infer<typeof ProjectConfig>;
