// This file was generated automatically from ProjectConfig.json

/**
 * Data source specification.
 */
export type DataSource = FileDataSource | UrlDataSource | SqlQueryDataSource;
/**
 * View configuration.
 */
export type ViewConfig = FlowmapViewConfig;
export type Attributes = {
  type?: 'numeric' | 'string' | 'date';
  column: string;
  label: string;
  expression: string;
}[];
export type FlowmapLocationFilterMode =
  | 'ALL'
  | 'INCOMING'
  | 'OUTGOING'
  | 'BETWEEN';
/**
 * Chart configuration.
 */
export type ChartConfig = VgPlotChartConfig;
export type MosaicLayoutNode = string | MosaicLayoutParent;

/**
 * Project configuration.
 */
export interface ProjectConfig {
  /**
   * Config version, currently 1.
   */
  version?: 1;
  /**
   * Project title.
   */
  title?: string;
  /**
   * Project description.
   */
  description?: string;
  /**
   * Data sources. Each data source must have a unique tableName.
   */
  dataSources?: DataSource[];
  /**
   * Views are data representations or various configuration panels.
   */
  views?: ViewConfig[];
  charts?: ChartConfig[];
  /**
   * Layout specifies how views are arranged on the screen.
   */
  layout?: MosaicLayoutConfig;
}
export interface FileDataSource {
  type: 'file';
  /**
   * Unique table name used to store the data loaded from the data source.
   */
  tableName: string;
  /**
   * Currently only CSV and Parquet files are supported.
   */
  fileName: string;
}
export interface UrlDataSource {
  type: 'url';
  /**
   * Unique table name used to store the data loaded from the data source.
   */
  tableName: string;
  /**
   * URL to fetch data from. Currently only CSV and Parquet files are supported.
   */
  url: string;
}
export interface SqlQueryDataSource {
  type: 'sql';
  /**
   * Unique table name used to store the data loaded from the data source.
   */
  tableName: string;
  /**
   * SQL query to execute.
   */
  sqlQuery: string;
}
export interface FlowmapViewConfig {
  type: 'od-flowmap';
  /**
   * Unique view ID.
   */
  id: string;
  columnMapping: FlowmapColumnMapping;
  filter?: FlowmapFilterState;
  viewport?: MapViewport;
  settings?: FlowmapSettings;
  basemap?:
    | {
        enabled?: boolean;
        opacity?: number;
        mapStyle?:
          | 'default'
          | 'standard'
          | 'dark'
          | 'light'
          | 'streets'
          | 'outdoors'
          | 'satellite'
          | 'satelliteStreets'
          | 'navigationDay'
          | 'navigationNight';
        accessToken?: string;
      }
    | {
        enabled?: boolean;
        opacity?: number;
        mapStyle: 'custom';
        accessToken?: string;
        mapStyleUrl: string;
      };
}
/**
 * Column mapping for flowmap view.
 */
export interface FlowmapColumnMapping {
  /**
   * Column mapping for locations.
   */
  locations: {
    tableName?: string;
    columns: Columns;
    attributes?: Attributes;
  };
  /**
   * Column mapping for flows.
   */
  flows: {
    tableName?: string;
    columns: Columns;
    attributes?: Attributes;
  };
  numericTimeFormat?: 'sec' | 'ms';
}
export interface Columns {
  [k: string]: string;
}
export interface FlowmapFilterState {
  selectedLocations?: (string | number)[];
  locationFilterMode?: FlowmapLocationFilterMode;
  /**
   * @minItems 2
   * @maxItems 2
   */
  selectedTimeRange?: [string, string];
  attrs?: {
    [k: string]: FlowmapAttrFilterValue;
  };
  /**
   * If set, cluster zoom level will be fixed.
   */
  fixClusterZoom?: number;
}
export interface FlowmapAttrFilterValue {
  type: 'ATTR';
  attr: string;
  value: string;
}
/**
 * Map viewport configuration.
 */
export interface MapViewport {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
}
export interface FlowmapSettings {
  /**
   * Whether to use animation to show flow directions.
   */
  animationEnabled?: boolean;
  /**
   * Whether to fade out flows with smaller magnitudes.
   */
  fadeEnabled?: boolean;
  /**
   * The amount of fading out for flows with smaller magnitudes.
   */
  fadeAmount?: number;
  /**
   * Whether to use opacity to fade out flows.
   */
  fadeOpacityEnabled?: boolean;
  /**
   * Whether to show locations.
   */
  locationsEnabled?: boolean;
  /**
   * Whether to show location totals.
   */
  locationTotalsEnabled?: boolean;
  /**
   * Whether to cluster locations.
   */
  clusteringEnabled?: boolean;
  /**
   * Whether to automatically choose the clustering level depending on the map zoom level.
   */
  clusteringAuto?: boolean;
  /**
   * Clustering level for manual clustering.
   */
  clusteringLevel?: number;
  /**
   * Whether to use dark mode for the base map and the flow map.  The color scheme will be reversed if dark mode is enabled.
   */
  darkMode?: boolean;
  /**
   * Color scheme for flow map. Can be either one of the predefined ones or a list of hex colors.
   */
  colorScheme?:
    | (
        | 'Default'
        | 'Alt'
        | 'Alt2'
        | 'Pl2'
        | 'Pl3'
        | 'Blues'
        | 'BluGrn'
        | 'BluYl'
        | 'BrwnYl'
        | 'BuGn'
        | 'BuPu'
        | 'Burg'
        | 'BurgYl'
        | 'Cool'
        | 'DarkMint'
        | 'Emrld'
        | 'GnBu'
        | 'Grayish'
        | 'Greens'
        | 'Greys'
        | 'Inferno'
        | 'Magenta'
        | 'Magma'
        | 'Mint'
        | 'Oranges'
        | 'OrRd'
        | 'OrYel'
        | 'Peach'
        | 'Plasma'
        | 'PinkYl'
        | 'PuBu'
        | 'PuBuGn'
        | 'PuRd'
        | 'Purp'
        | 'Purples'
        | 'PurpOr'
        | 'RdPu'
        | 'RedOr'
        | 'Reds'
        | 'Sunset'
        | 'SunsetDark'
        | 'Teal'
        | 'TealGrn'
        | 'Viridis'
        | 'Warm'
        | 'YlGn'
        | 'YlGnBu'
        | 'YlOrBr'
        | 'YlOrRd'
      )
    | string[];
  /**
   * Color for highlighted flows.
   */
  highlightColor?: string;
  /**
   * Maximum number of top flows to display at any time. If exceeded, only the flows with the top magnitudes will be displayed
   */
  maxTopFlowsDisplayNum?: number;
}
export interface VgPlotChartConfig {
  /**
   * Chart type.
   */
  type: 'vgplot';
  /**
   * Chart title.
   */
  title?: string;
  /**
   * Chart description.
   */
  description?: string;
  /**
   * Mosaic vgplot specification for a chart. See https://uwdata.github.io/mosaic/vgplot/
   */
  spec: {
    style?: {
      [k: string]: unknown;
    };
  } & {
    [k: string]: unknown;
  };
}
export interface MosaicLayoutConfig {
  type: 'mosaic';
  nodes: MosaicLayoutNode | null;
  pinned?: string[];
  fixed?: string[];
}
export interface MosaicLayoutParent {
  direction: 'row' | 'column';
  splitPercentage?: number;
  first: MosaicLayoutNode;
  second: MosaicLayoutNode;
}
