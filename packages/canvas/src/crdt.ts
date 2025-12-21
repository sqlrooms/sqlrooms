import {schema} from 'loro-mirror';
import type {CrdtMirror} from '@sqlrooms/crdt';
import {
  CanvasSliceConfig,
  type CanvasSliceState,
  type CanvasNode,
} from './CanvasSlice';

/**
 * Mirror schema for syncing the `@sqlrooms/canvas` slice via `@sqlrooms/crdt`.
 *
 * This is intentionally exported from a separate entrypoint (`@sqlrooms/canvas/crdt`)
 * so consumer apps only pull `loro-mirror` when they opt into CRDT sync.
 */
export const canvasMirrorSchema = schema.LoroMap({
  config: schema.LoroMap({
    dags: schema.LoroList(
      schema.LoroMap({
        id: schema.String(),
        cells: schema.LoroList(
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
          (cell) => cell.id,
        ),
        meta: schema.LoroMap({
          edges: schema.LoroList(
            schema.LoroMap({
              id: schema.String(),
              source: schema.String(),
              target: schema.String(),
            }),
            (edge) => edge.id,
          ),
          nodeOrder: schema.LoroList(schema.String()),
          // viewport is kept local (unsynced)
        }),
      }),
      (dag) => dag.id,
    ),
    dagOrder: schema.LoroList(schema.String()),
    currentDagId: schema.String(),
  }),
});

export type CanvasMirrorSchema = typeof canvasMirrorSchema;

/**
 * Default initial mirror state for the canvas CRDT schema.
 */
export const canvasMirrorInitialState = {
  config: {
    dags: [],
    dagOrder: [],
    currentDagId: '',
  },
};

/**
 * Creates a CRDT mirror bundle for the canvas slice.
 *
 * Use this with `@sqlrooms/crdt`'s `createCrdtSlice({ mirrors: { ... } })` to
 * compose multiple slice schemas/bindings on a single shared Loro document.
 */
export function createCanvasCrdtMirror<
  S extends CanvasSliceState = CanvasSliceState,
>(): CrdtMirror<S, typeof canvasMirrorSchema> {
  return {
    schema: canvasMirrorSchema,
    initialState: canvasMirrorInitialState,
    select: (state) => ({
      config: {
        dags: Object.values(state.canvas.config.dags).map((dag) => ({
          id: dag.id,
          cells: Object.values(dag.cells),
          meta: {
            edges: dag.meta.edges,
            nodeOrder: dag.meta.nodeOrder,
          },
        })),
        dagOrder: state.canvas.config.dagOrder,
        currentDagId: state.canvas.config.currentDagId || '',
      },
    }),
    apply: (value, set, get) => {
      if (!value?.config) return;
      const currentConfig = get().canvas.config;

      const newDags: Record<string, any> = {};
      for (const dagValue of value.config.dags || []) {
        const localDag = currentConfig.dags[dagValue.id];
        newDags[dagValue.id] = {
          id: dagValue.id,
          cells: (dagValue.cells || []).reduce(
            (acc: Record<string, any>, cell: any) => {
              acc[cell.id] = cell;
              return acc;
            },
            {},
          ),
          meta: {
            ...dagValue.meta,
            // Keep local viewport or use default
            viewport: localDag?.meta.viewport ?? {x: 0, y: 0, zoom: 1},
          },
        };
      }

      set((state: S) => ({
        ...state,
        canvas: {
          ...state.canvas,
          config: CanvasSliceConfig.parse({
            ...currentConfig,
            ...value.config,
            dags: newDags,
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
