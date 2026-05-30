import {schema} from 'loro-mirror';
import type {CrdtMirror} from '@sqlrooms/crdt';
import {CanvasSliceConfig, type CanvasSliceState} from './CanvasSlice';

/**
 * Mirror schema for syncing the `@sqlrooms/canvas` slice via `@sqlrooms/crdt`.
 */
export const canvasMirrorSchema = schema.LoroMap({
  config: schema.LoroMap({
    artifacts: schema.LoroList(
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
      (artifact) => artifact.id,
    ),
  }),
});

export type CanvasMirrorSchema = typeof canvasMirrorSchema;

/**
 * Default initial mirror state for the canvas CRDT schema.
 */
export const canvasMirrorInitialState = {
  config: {
    artifacts: [],
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
        artifacts: Object.values(state.canvas.config.artifacts).map(
          (artifact) => ({
            id: artifact.id,
            nodes: Object.values(artifact.nodes),
            meta: {
              nodeOrder: artifact.meta.nodeOrder,
            },
          }),
        ),
      },
    }),
    apply: (value, set, get) => {
      if (!value?.config) return;
      const currentConfig = get().canvas.config;

      const newArtifacts: Record<string, any> = {};
      for (const artifactValue of value.config.artifacts || []) {
        const localArtifact = currentConfig.artifacts[artifactValue.id];
        newArtifacts[artifactValue.id] = {
          id: artifactValue.id,
          nodes: (artifactValue.nodes || []).reduce(
            (acc: Record<string, any>, node: any) => {
              acc[node.id] = node;
              return acc;
            },
            {},
          ),
          meta: {
            ...artifactValue.meta,
            // Keep local viewport or use default
            viewport: localArtifact?.meta.viewport ?? {x: 0, y: 0, zoom: 1},
          },
        };
      }

      set((state: S) => ({
        ...state,
        canvas: {
          ...state.canvas,
          config: CanvasSliceConfig.parse({
            ...currentConfig,
            artifacts: newArtifacts,
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
