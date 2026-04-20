import {ColorScaleConfig, RGBAColor} from '@sqlrooms/color-scales';
import {z} from 'zod';

export const GeometryEncodingHint = z.enum(['geoarrow', 'wkb', 'wkt']);
export type GeometryEncodingHint = z.infer<typeof GeometryEncodingHint>;

export const DeckColorScaleProp = z.enum(['getFillColor', 'getLineColor']);
export type DeckColorScaleProp = z.infer<typeof DeckColorScaleProp>;

export const LayerExtensionConfig = z.object({
  dataset: z.string().min(1).optional(),
  geometryColumn: z.string().min(1).optional(),
  geometryEncodingHint: GeometryEncodingHint.optional(),
  colorScale: ColorScaleConfig.optional(),
  colorScaleProp: DeckColorScaleProp.optional(),
});
export type LayerExtensionConfig = z.infer<typeof LayerExtensionConfig>;

export const LayerExtensionProps = z.object({
  _sqlrooms: LayerExtensionConfig.optional(),
});
export type LayerExtensionProps = z.infer<typeof LayerExtensionProps>;

const JsonAccessor = z.union([
  z.string(),
  z.number(),
  RGBAColor,
  z.array(z.number()),
]);

// Keep the layer spec loose for now because `DeckMap` accepts deck.gl JSON as an
// external spec format, and that surface is much broader than SQLRooms-owned
// `_sqlrooms` extensions. We validate the extension config fully and a handful of
// common deck props we know we rely on, while allowing the rest through.
// TODO(deck-json-schema): Replace this with fuller schemas when deck.gl/json
// exposes reusable validators or we decide to maintain a broader local schema.
export const DeckMapLayerSpec = z.looseObject({
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
  getPosition: JsonAccessor.optional(),
  getPolygon: JsonAccessor.optional(),
  getPath: JsonAccessor.optional(),
  _sqlrooms: LayerExtensionConfig.optional(),
});
export type DeckMapLayerSpec = z.infer<typeof DeckMapLayerSpec>;

// Keep the top-level spec loose for the same reason as `DeckMapLayerSpec`: deck.gl
// JSON supports many runtime-level props, and SQLRooms currently only needs a
// validated subset plus open-ended compatibility with upstream deck specs.
// TODO(deck-json-schema): Replace this with fuller schemas when we have a more
// complete upstream or local model of deck.gl/json top-level props.
export const DeckMapSpec = z.looseObject({
  initialViewState: z.record(z.string(), z.unknown()).optional(),
  viewState: z.record(z.string(), z.unknown()).optional(),
  controller: z
    .union([z.boolean(), z.record(z.string(), z.unknown())])
    .optional(),
  layers: z.array(DeckMapLayerSpec).optional(),
});
export type DeckMapSpec = z.infer<typeof DeckMapSpec>;
