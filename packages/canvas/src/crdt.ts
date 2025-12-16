import {schema} from 'loro-mirror';
import {CanvasSliceConfig, type CanvasSliceState} from './CanvasSlice';

/**
 * Mirror schema for syncing the `@sqlrooms/canvas` slice via `@sqlrooms/crdt`.
 *
 * This is intentionally exported from a separate entrypoint (`@sqlrooms/canvas/crdt`)
 * so consumer apps only pull `loro-mirror` when they opt into CRDT sync.
 */
export const canvasMirrorSchema = schema({
  canvas: schema.LoroMap({
    config: schema.LoroMap({
      nodes: schema.LoroList(
        schema.LoroMap({
          id: schema.String(),
          position: schema.LoroMap({
            x: schema.Number(),
            y: schema.Number(),
          }),
          type: schema.String(),
          data: schema.Any(),
          width: schema.Number(),
          height: schema.Number(),
        }),
        (node) => node.id,
      ),
      edges: schema.LoroList(
        schema.LoroMap({
          id: schema.String(),
          source: schema.String(),
          target: schema.String(),
        }),
        (edge) => edge.id,
      ),
    }),
  }),
});

export type CanvasMirrorSchema = typeof canvasMirrorSchema;

/**
 * Default initial mirror state for the canvas CRDT schema.
 */
export const canvasMirrorInitialState = {
  canvas: {
    config: {
      nodes: [],
      edges: [],
    },
  },
} as const;

/**
 * Minimal binding shape compatible with `@sqlrooms/crdt`'s `CrdtBinding`.
 *
 * We intentionally keep `select` / `apply` value types as `any` because Mirror
 * attaches internal metadata (e.g. `$cid`) on map objects that is not present
 * in the Zustand store state.
 */
export type CanvasCrdtBinding<S> = {
  key: 'canvas';
  select: (state: S) => any;
  apply: (value: any, set: any, get: any) => void;
};

/**
 * Creates the default CRDT binding for the canvas slice.
 *
 * The binding syncs `canvas.config.nodes` and `canvas.config.edges`, while keeping
 * `canvas.config.viewport` local (unsynced) by default.
 */
export function createCanvasCrdtBindings<
  S extends CanvasSliceState = CanvasSliceState,
>(): CanvasCrdtBinding<S>[] {
  return [
    {
      key: 'canvas',
      select: (state) => ({
        config: {
          nodes: state.canvas.config.nodes,
          edges: state.canvas.config.edges,
        },
      }),
      apply: (value, set, get) => {
        if (!value?.config) return;
        set((state: S) => ({
          ...state,
          canvas: {
            ...state.canvas,
            config: CanvasSliceConfig.parse({
              ...get().canvas.config,
              ...value.config,
              // Keep local viewport unsynced
              viewport: get().canvas.config.viewport,
            }),
          },
        }));
      },
    },
  ];
}

/**
 * Creates a CRDT mirror bundle for the canvas slice.
 *
 * Use this with `@sqlrooms/crdt`'s `createCrdtSlice({ mirrors: [...] })` to
 * compose multiple slice schemas/bindings on a single shared Loro document.
 */
export function createCanvasCrdtMirror<
  S extends CanvasSliceState = CanvasSliceState,
>() {
  return {
    schema: canvasMirrorSchema,
    bindings: createCanvasCrdtBindings<S>(),
    initialState: canvasMirrorInitialState,
  };
}

/**
 * @deprecated Use `createCanvasCrdtMirror` instead.
 */
export const createCanvasCrdtModule = createCanvasCrdtMirror;
