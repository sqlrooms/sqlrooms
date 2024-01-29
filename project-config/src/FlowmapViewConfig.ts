import {z} from 'zod';
import {ColumnMapping} from './common';

export enum LocationFilterMode {
  ALL = 'ALL',
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  BETWEEN = 'BETWEEN',
}

export const FlowmapColorSchemeKey = z.enum([
  'Default',
  'Alt',
  'Alt2',
  'Pl2',
  'Pl3',
  'Blues',
  'BluGrn',
  'BluYl',
  'BrwnYl',
  'BuGn',
  'BuPu',
  'Burg',
  'BurgYl',
  'Cool',
  'DarkMint',
  'Emrld',
  'GnBu',
  'Grayish',
  'Greens',
  'Greys',
  'Inferno',
  'Magenta',
  'Magma',
  'Mint',
  'Oranges',
  'OrRd',
  'OrYel',
  'Peach',
  'Plasma',
  'PinkYl',
  'PuBu',
  'PuBuGn',
  'PuRd',
  'Purp',
  'Purples',
  'PurpOr',
  'RdPu',
  'RedOr',
  'Reds',
  'Sunset',
  'SunsetDark',
  'Teal',
  'TealGrn',
  'Viridis',
  'Warm',
  'YlGn',
  'YlGnBu',
  'YlOrBr',
  'YlOrRd',
]);
export type FlowmapColorSchemeKey = z.infer<typeof FlowmapColorSchemeKey>;

const DEFAULT_BASEMAP_OPACITY = 60;

export const DEFAULT_BASEMAP_SETTINGS: BasemapSettings = {
  opacity: DEFAULT_BASEMAP_OPACITY,
  enabled: true,
  mapStyle: 'default',
};

export const BasemapStyle = z.enum([
  'default',
  'standard',
  'dark',
  'light',
  'streets',
  'outdoors',
  'satellite',
  'satelliteStreets',
  'navigationDay',
  'navigationNight',
]);
export type BasemapStyle = z.infer<typeof BasemapStyle>;

export const BasemapStyleCustom = z.literal('custom');
export type BasemapStyleCustom = z.infer<typeof BasemapStyleCustom>;

const BaseBasemapSettings = z.object({
  enabled: z.boolean().default(true),
  opacity: z.number().min(0).max(100).default(DEFAULT_BASEMAP_OPACITY),
  mapStyle: BasemapStyle,
  accessToken: z.string().optional(),
});

export const BasemapSettings = z.preprocess(
  (v: any) => {
    if (
      v.mapStyle &&
      v.mapStyle !== BasemapStyleCustom.value &&
      !BasemapStyle.options.includes(v.mapStyle)
    ) {
      return {
        ...v,
        mapStyle: BasemapStyleCustom.value,
        mapStyleUrl: v.mapStyle,
      };
    }
    return v;
  },
  z.union([
    BaseBasemapSettings.extend({
      mapStyle: BasemapStyle.default('default'),
    }),
    BaseBasemapSettings.extend({
      mapStyle: BasemapStyleCustom,
      mapStyleUrl: z.string(),
    }),
  ]),
);
export type BasemapSettings = z.infer<typeof BasemapSettings>;

export const DEFAULT_VIEWPORT = {
  latitude: 0,
  longitude: 0,
  zoom: 0.5,
  pitch: 0,
  bearing: 0,
};

export const MapViewport = z
  .object({
    // width: z.number(), // needed by DuckFlowmapDataProvider
    // height: z.number(),
    latitude: z.number().default(DEFAULT_VIEWPORT.latitude),
    longitude: z.number().default(DEFAULT_VIEWPORT.longitude),
    zoom: z.number().optional().default(DEFAULT_VIEWPORT.zoom), // to align with ViewportProps in flowmap.gl
    pitch: z.number().optional().default(DEFAULT_VIEWPORT.pitch),
    bearing: z.number().optional().default(DEFAULT_VIEWPORT.bearing),
  })
  .describe('Map viewport configuration.');
export type MapViewport = z.infer<typeof MapViewport>;

export const DEFAULT_COLOR_SCHEME = FlowmapColorSchemeKey.enum.Default;
export const DEFAULT_FLOWMAP_SETTINGS = {
  darkMode: true,
  fadeAmount: 40,
  locationsEnabled: true,
  locationTotalsEnabled: true,
  locationLabelsEnabled: false,
  animationEnabled: false,
  clusteringEnabled: true,
  fadeEnabled: true,
  fadeOpacityEnabled: false,
  clusteringAuto: true,
  clusteringLevel: undefined,
  colorScheme: DEFAULT_COLOR_SCHEME,
  highlightColor: 'orange',
  maxTopFlowsDisplayNum: 5000,
};

export const FlowmapSettings = z.object({
  animationEnabled: z
    .boolean()
    .describe('Whether to use animation to show flow directions.')
    .default(DEFAULT_FLOWMAP_SETTINGS.animationEnabled),
  fadeEnabled: z
    .boolean()
    .describe('Whether to fade out flows with smaller magnitudes.')
    .default(DEFAULT_FLOWMAP_SETTINGS.fadeEnabled),
  fadeAmount: z
    .number()
    .min(0)
    .max(100)
    .describe('The amount of fading out for flows with smaller magnitudes.')
    .default(DEFAULT_FLOWMAP_SETTINGS.fadeAmount),
  fadeOpacityEnabled: z
    .boolean()
    .describe('Whether to use opacity to fade out flows.')
    .default(DEFAULT_FLOWMAP_SETTINGS.fadeOpacityEnabled),
  locationsEnabled: z
    .boolean()
    .describe('Whether to show locations.')
    .default(DEFAULT_FLOWMAP_SETTINGS.locationsEnabled),
  locationTotalsEnabled: z
    .boolean()
    .describe('Whether to show location totals.')
    .default(DEFAULT_FLOWMAP_SETTINGS.locationTotalsEnabled),
  // locationLabelsEnabled: z
  //   .boolean()
  //   .describe('Whether to show location labels.')
  //   .default(DEFAULT_FLOWMAP_SETTINGS.locationLabelsEnabled),
  // adaptiveScalesEnabled: z.boolean().default(DEFAULT_FLOWMAP_SETTINGS.//),
  clusteringEnabled: z
    .boolean()
    .describe('Whether to cluster locations.')
    .default(DEFAULT_FLOWMAP_SETTINGS.clusteringEnabled),
  clusteringAuto: z
    .boolean()
    .describe(
      'Whether to automatically choose the clustering level depending on the map zoom level.',
    )
    .default(DEFAULT_FLOWMAP_SETTINGS.clusteringAuto),
  clusteringLevel: z
    .number()
    .optional()
    .describe('Clustering level for manual clustering.'),
  darkMode: z
    .boolean()
    .default(DEFAULT_FLOWMAP_SETTINGS.darkMode)
    .describe(
      'Whether to use dark mode for the base map and the flow map. ' +
        ' The color scheme will be reversed if dark mode is enabled.',
    ),
  colorScheme: z
    .union([FlowmapColorSchemeKey, z.array(z.string())])
    .describe(
      'Color scheme for flow map. Can be either one of the predefined ones or a list of hex colors.',
    )
    .default(DEFAULT_FLOWMAP_SETTINGS.colorScheme),
  highlightColor: z
    .string()
    .default(DEFAULT_FLOWMAP_SETTINGS.highlightColor)
    .describe('Color for highlighted flows.'),
  maxTopFlowsDisplayNum: z
    .number()
    .describe(
      'Maximum number of top flows to display at any time. ' +
        'If exceeded, only the flows with the top magnitudes will be displayed',
    )
    .default(DEFAULT_FLOWMAP_SETTINGS.maxTopFlowsDisplayNum),
});
export type FlowmapSettings = z.infer<typeof FlowmapSettings>;

export const FlowmapLocationFilterMode = z.nativeEnum(LocationFilterMode);
export type FlowmapLocationFilterMode = z.infer<
  typeof FlowmapLocationFilterMode
>;

// TODO: make it a zod type
export const FlowmapFilterType = z.enum(['LOCATIONS', 'TIME', 'ATTR']);
export type FlowmapFilterType = z.infer<typeof FlowmapFilterType>;

export const FlowmapAttrFilterValue = z.object({
  type: z.literal(FlowmapFilterType.enum.ATTR),
  attr: z.string(),
  value: z.string(),
});
export type FlowmapAttrFilterValue = z.infer<typeof FlowmapAttrFilterValue>;

export const FlowmapLocationFilterValue = z.object({
  type: z.literal(FlowmapFilterType.enum.LOCATIONS),
  value: z.array(z.union([z.string(), z.number()])),
  mode: FlowmapLocationFilterMode,
});
export type FlowmapLocationFilterValue = z.infer<
  typeof FlowmapLocationFilterValue
>;

export const FlowmapTimeFilterValue = z.object({
  type: z.literal(FlowmapFilterType.enum.TIME),
  value: z.tuple([z.coerce.date(), z.coerce.date()]),
});
export type FlowmapTimeFilterValue = z.infer<typeof FlowmapTimeFilterValue>;

export const FlowmapFilterValue = z.discriminatedUnion('type', [
  FlowmapAttrFilterValue,
  FlowmapLocationFilterValue,
  FlowmapTimeFilterValue,
]);
export type FlowmapFilterValue = z.infer<typeof FlowmapFilterValue>;

export const FlowmapFilterState = z.object({
  selectedLocations: z.array(z.union([z.string(), z.number()])).optional(),
  locationFilterMode: FlowmapLocationFilterMode.optional(),
  // TODO: why do we have both selectedTimeRange and FlowmapTimeFilterValue?
  // and selectedLocations and FlowmapLocationFilterValue?
  selectedTimeRange: z.tuple([z.coerce.date(), z.coerce.date()]).optional(),
  attrs: z.record(FlowmapAttrFilterValue).optional(),
  fixClusterZoom: z
    .number()
    .optional()
    .describe('If set, cluster zoom level will be fixed.'),
});

export const ViewConfigKind = z.enum(['od-flowmap']);
export type ViewConfigKind = z.infer<typeof ViewConfigKind>;

export const NumericTimeFormat = z.enum(['sec', 'ms']);
export type NumericTimeFormat = z.infer<typeof NumericTimeFormat>;

// TODO: shouldn't column mappings live within the view config? (like layer configs in Studio)
export const FlowmapColumnMapping = z
  .object({
    locations: ColumnMapping.describe('Column mapping for locations.'),
    flows: ColumnMapping.describe('Column mapping for flows.'),
    numericTimeFormat: NumericTimeFormat.optional(), // TODO: remove this?
  })
  .describe('Column mapping for flowmap view.');
export type FlowmapColumnMapping = z.infer<typeof FlowmapColumnMapping>;

// This must be compatible with FlowmapState from @flowmap.gl/data
// because it will be passed to selectors
export const FlowmapViewConfig = z.object({
  type: z.literal(ViewConfigKind.enum['od-flowmap']),
  id: z.string().describe('Unique view ID.'),
  columnMapping: FlowmapColumnMapping,
  filter: FlowmapFilterState.optional(), // TODO: this filter cannot be generalized to custom queries
  viewport: MapViewport.default(DEFAULT_VIEWPORT),
  settings: FlowmapSettings.default(DEFAULT_FLOWMAP_SETTINGS),
  basemap: BasemapSettings.default(DEFAULT_BASEMAP_SETTINGS),
});
export type FlowmapViewConfig = z.infer<typeof FlowmapViewConfig>;
