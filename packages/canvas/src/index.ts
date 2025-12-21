/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createCanvasSlice, createDefaultCanvasConfig} from './CanvasSlice';
export type {CanvasSliceConfig} from './CanvasSlice';
export type {
  CanvasSliceState,
  CanvasDagMeta,
  CanvasNode as CanvasNodeSchema,
} from './CanvasSlice';
export {
  CanvasSliceConfig as CanvasSliceConfigSchema,
  CanvasEdge as CanvasEdgeSchema,
} from './CanvasSlice';
export {Canvas} from './Canvas';
