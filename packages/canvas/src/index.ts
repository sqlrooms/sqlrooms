/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createCanvasSlice, createDefaultCanvasConfig} from './CanvasSlice';
export type {
  CanvasSliceConfig,
  CanvasSliceState,
  CanvasNodeMeta,
  CanvasSheetMeta,
} from './CanvasSlice';
export {
  CanvasSliceConfigSchema,
  CanvasNodeMeta as CanvasNodeMetaSchema,
  CanvasSheetMeta as CanvasSheetMetaSchema,
} from './CanvasSlice';
export {Canvas} from './Canvas';
