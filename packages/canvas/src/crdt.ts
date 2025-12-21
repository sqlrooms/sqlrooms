import {schema} from 'loro-mirror';
import type {CrdtMirror} from '@sqlrooms/crdt';
import {CanvasSliceConfigSchema, type CanvasSliceState} from './CanvasSlice';

/**
 * Mirror schema for syncing the `@sqlrooms/canvas` slice via `@sqlrooms/crdt`.
 */
export const canvasMirrorSchema = schema.LoroMap({
  config: schema.LoroMap({
    sheets: schema.LoroList(
      schema.LoroMap({
        id: schema.String(),
        nodes: schema.LoroList(
          schema.LoroMap({
            id: schema.String(),
            position: schema.LoroMap({
              x: schema.Number(),
              y: schema.Number(),
            }),
            width: schema.Number(),
            height: schema.Number(),
          }),
          (node) => node.id,
        ),
        meta: schema.LoroMap({
          nodeOrder: schema.LoroList(schema.String()),
          // viewport is kept local (unsynced)
        }),
      }),
      (sheet) => sheet.id,
    ),
  }),
});

export type CanvasMirrorSchema = typeof canvasMirrorSchema;

/**
 * Default initial mirror state for the canvas CRDT schema.
 */
export const canvasMirrorInitialState = {
  config: {
    sheets: [],
  },
};

/**
 * Creates a CRDT mirror bundle for the canvas slice.
 */
export function createCanvasCrdtMirror<
  S extends CanvasSliceState = CanvasSliceState,
>(): CrdtMirror<S, typeof canvasMirrorSchema> {
  return {
    schema: canvasMirrorSchema,
    initialState: canvasMirrorInitialState,
    select: (state) => ({
      config: {
        sheets: Object.values(state.canvas.config.sheets).map((sheet) => ({
          id: sheet.id,
          nodes: Object.values(sheet.nodes),
          meta: {
            nodeOrder: sheet.meta.nodeOrder,
          },
        })),
      },
    }),
    apply: (value, set, get) => {
      if (!value?.config) return;
      const currentConfig = get().canvas.config;

      const newSheets: Record<string, any> = {};
      for (const sheetValue of value.config.sheets || []) {
        const localSheet = currentConfig.sheets[sheetValue.id];
        newSheets[sheetValue.id] = {
          id: sheetValue.id,
          nodes: (sheetValue.nodes || []).reduce(
            (acc: Record<string, any>, node: any) => {
              acc[node.id] = node;
              return acc;
            },
            {},
          ),
          meta: {
            ...sheetValue.meta,
            // Keep local viewport or use default
            viewport: localSheet?.meta.viewport ?? {x: 0, y: 0, zoom: 1},
          },
        };
      }

      set((state: S) => ({
        ...state,
        canvas: {
          ...state.canvas,
          config: CanvasSliceConfigSchema.parse({
            ...currentConfig,
            sheets: newSheets,
          }),
        },
      }));
    },
  };
}

/**
 * @deprecated Use `createCanvasCrdtMirror` instead.
 */
export const createCanvasCrdtModule = createCanvasCrdtMirror;
