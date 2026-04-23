import {ColorScaleConfig, RGBAColor} from '@sqlrooms/color-scales';
import {z} from 'zod';

export const GeometryEncodingHint = z.enum(['geoarrow', 'wkb', 'wkt']);
export type GeometryEncodingHint = z.infer<typeof GeometryEncodingHint>;

export const ColorScaleFunction = z.intersection(
  z.object({
    '@@function': z.literal('colorScale'),
  }),
  ColorScaleConfig,
);
export type ColorScaleFunction = z.infer<typeof ColorScaleFunction>;

export const LayerBindingConfig = z.object({
  dataset: z.string().min(1).optional(),
  geometryColumn: z.string().min(1).optional(),
  geometryEncodingHint: GeometryEncodingHint.optional(),
  sourceGeometryColumn: z.string().min(1).optional(),
  targetGeometryColumn: z.string().min(1).optional(),
  timestampColumn: z.string().min(1).optional(),
  hexagonColumn: z.string().min(1).optional(),
});
export type LayerBindingConfig = z.infer<typeof LayerBindingConfig>;

export const LayerBindingProps = z.object({
  _sqlroomsBinding: LayerBindingConfig.optional(),
});
export type LayerBindingProps = z.infer<typeof LayerBindingProps>;

const JsonAccessor = z.union([
  z.string(),
  z.number(),
  RGBAColor,
  z.array(z.number()),
  ColorScaleFunction,
]);

// Keep the layer spec loose for now because `DeckJsonMap` accepts deck.gl JSON as an
// external spec format, and that surface is much broader than SQLRooms-owned
// `_sqlroomsBinding` extensions. We validate the binding config fully and a handful of
// common deck props we know we rely on, while allowing the rest through.
// TODO(deck-json-schema): Replace this with fuller schemas when deck.gl/json
// exposes reusable validators or we decide to maintain a broader local schema.
export const DeckJsonMapLayerSpec = z.looseObject({
  '@@type': z.string().optional(),
  id: z.string().optional(),
  data: z.unknown().optional(),
  visible: z.boolean().optional(),
  pickable: z.boolean().optional(),
  filled: z.boolean().optional(),
  stroked: z.boolean().optional(),
  extruded: z.boolean().optional(),
  radiusScale: z.number().optional(),
  radiusUnits: z.string().optional(),
  radiusMinPixels: z.number().optional(),
  radiusMaxPixels: z.number().optional(),
  lineWidthMinPixels: z.number().optional(),
  lineWidthScale: z.number().optional(),
  lineWidthUnits: z.string().optional(),
  getRadius: JsonAccessor.optional(),
  getFillColor: JsonAccessor.optional(),
  getLineColor: JsonAccessor.optional(),
  getColor: JsonAccessor.optional(),
  getWeight: JsonAccessor.optional(),
  getWidth: JsonAccessor.optional(),
  getHeight: JsonAccessor.optional(),
  getTilt: JsonAccessor.optional(),
  getElevation: JsonAccessor.optional(),
  getSourceColor: JsonAccessor.optional(),
  getTargetColor: JsonAccessor.optional(),
  getPosition: JsonAccessor.optional(),
  getSourcePosition: JsonAccessor.optional(),
  getTargetPosition: JsonAccessor.optional(),
  getPolygon: JsonAccessor.optional(),
  getPath: JsonAccessor.optional(),
  getHexagon: JsonAccessor.optional(),
  getTimestamps: JsonAccessor.optional(),
  _sqlroomsBinding: LayerBindingConfig.optional(),
});
export type DeckJsonMapLayerSpec = z.infer<typeof DeckJsonMapLayerSpec>;

// Keep the top-level spec loose for the same reason as `DeckJsonMapLayerSpec`: deck.gl
// JSON supports many runtime-level props, and SQLRooms currently only needs a
// validated subset plus open-ended compatibility with upstream deck specs.
// TODO(deck-json-schema): Replace this with fuller schemas when we have a more
// complete upstream or local model of deck.gl/json top-level props.
export const DeckJsonMapSpec = z.looseObject({
  initialViewState: z.record(z.string(), z.unknown()).optional(),
  viewState: z.record(z.string(), z.unknown()).optional(),
  controller: z
    .union([z.boolean(), z.record(z.string(), z.unknown())])
    .optional(),
  layers: z.array(DeckJsonMapLayerSpec).optional(),
});
export type DeckJsonMapSpec = z.infer<typeof DeckJsonMapSpec>;
