import {InferInputType, InferType, Mirror, SchemaType} from 'loro-mirror';
import {LoroDoc} from 'loro-crdt';
import {StateCreator, StoreApi} from 'zustand';
import {setAutoFreeze} from 'immer';

// Mirror can’t stamp $cid on frozen objects, so disable auto-freeze.
setAutoFreeze(false);

type StoreSet<S> = Parameters<StateCreator<S>>[0];
type StoreGet<S> = Parameters<StateCreator<S>>[1];

export type MirrorSchema<T extends SchemaType = SchemaType> = T;

type InferredState<TSchema extends SchemaType> =
  InferType<TSchema> extends Record<string, any>
    ? InferType<TSchema>
    : Record<string, never>;

/**
 * Local equivalent of `createSlice` from `@sqlrooms/room-store`.
 *
 * Kept inline so `@sqlrooms/crdt` stays dependency-light (no need to depend on
 * `@sqlrooms/room-store` just for a typing helper).
 */
function createSlice<SliceState, StoreState extends SliceState = SliceState>(
  sliceCreator: (...args: Parameters<StateCreator<StoreState>>) => SliceState,
): StateCreator<SliceState> {
  return (set, get, store) =>
    sliceCreator(set, get as () => StoreState, store as StoreApi<StoreState>);
}

export type CrdtBinding<S, M, K extends keyof M & string = keyof M & string> = {
  key: K;
  select?: (state: S) => M[K];
  apply?: (value: M[K], set: StoreSet<S>, get: StoreGet<S>) => void;
};

export type CrdtDocStorage = {
  load: () => Promise<Uint8Array | undefined>;
  save: (data: Uint8Array) => Promise<void>;
};

export type CrdtSyncConnector = {
  connect: (doc: LoroDoc) => Promise<void>;
  disconnect?: () => Promise<void>;
};

export type CrdtMirror<S, TSchema extends SchemaType = SchemaType> = {
  schema: MirrorSchema<TSchema>;
  /**
   * Bindings are intentionally `any`-typed because Mirror schemas can attach
   * internal metadata (e.g. `$cid`) to mirrored objects that doesn't exist in
   * the Zustand store state.
   *
   * Keeping this loose makes it easy to compose modules from multiple packages
   * without fighting type-level details of `loro-mirror` inference.
   */
  bindings: Array<CrdtBinding<S, any>>;
  initialState?: any;
  mirrorOptions?: Record<string, unknown>;
};

export type CreateCrdtSliceOptions<S, TSchema extends SchemaType> = {
  /**
   * Optional multi-mirror configuration: allows composing multiple mirror schemas
   * (e.g. from multiple SQLRooms slices plus app-specific state) into a single
   * CRDT doc connection by creating one Mirror per mirror on a shared Loro doc.
   */
  mirrors?: Array<CrdtMirror<S, any>>;
  /**
   * @deprecated Use `mirrors` instead.
   */
  modules?: Array<CrdtMirror<S, any>>;
  schema?: MirrorSchema<TSchema>;
  bindings?: CrdtBinding<S, InferredState<TSchema>>[];
  doc?: LoroDoc;
  createDoc?: () => LoroDoc;
  initialState?: Partial<InferInputType<TSchema>>;
  storage?: CrdtDocStorage;
  sync?: CrdtSyncConnector;
  mirrorOptions?: Record<string, unknown>;
  onError?: (error: unknown) => void;
};

export type CrdtSliceState = {
  crdt: {
    status: 'idle' | 'ready' | 'error';
    error?: string;
    initialize: () => Promise<void>;
    destroy: () => Promise<void>;
  };
};

/**
 * Create a CRDT-backed slice that mirrors selected store fields into a Loro doc.
 *
 * The returned state creator is intended to be composed into a larger Zustand store.
 */
export function createCrdtSlice<
  S extends Record<string, any>,
  TSchema extends SchemaType,
>(options: CreateCrdtSliceOptions<S, TSchema>): StateCreator<CrdtSliceState> {
  return createSlice<CrdtSliceState, S & CrdtSliceState>((set, get, store) => {
    let doc: LoroDoc | undefined;
    let mirrors: Mirror<any>[] = [];
    let unsubStore: (() => void) | undefined;
    let unsubMirrors: Array<() => void> = [];
    let unsubDocLocal: (() => void) | undefined;
    let initializing: Promise<void> | undefined;
    let suppressStoreToMirror = false;
    const lastOutboundByModule = new Map<number, Record<string, unknown>>();

    const getMirrors = (): Array<CrdtMirror<S, any>> => {
      if (options.mirrors && options.modules) {
        throw new Error(
          '[crdt] Provide either `mirrors` or `modules`, not both.',
        );
      }
      if (options.mirrors) {
        if (options.schema || options.bindings || options.initialState) {
          throw new Error(
            '[crdt] Provide either `mirrors` or (`schema` + `bindings`), not both.',
          );
        }
        return options.mirrors;
      }
      if (options.modules) {
        if (options.schema || options.bindings || options.initialState) {
          throw new Error(
            '[crdt] Provide either `modules` or (`schema` + `bindings`), not both.',
          );
        }
        return options.modules;
      }
      if (!options.schema || !options.bindings) {
        throw new Error('[crdt] Missing required `schema` and `bindings`.');
      }
      return [
        {
          schema: options.schema as any,
          bindings: options.bindings as any,
          initialState: options.initialState,
          mirrorOptions: options.mirrorOptions,
        },
      ];
    };

    const validateBindings = (mirrorsCfg: Array<CrdtMirror<S, any>>) => {
      const seen = new Set<string>();
      for (const mirror of mirrorsCfg) {
        for (const b of mirror.bindings as Array<CrdtBinding<S, any>>) {
          const key = String(b.key);
          if (seen.has(key)) {
            throw new Error(
              `[crdt] Duplicate binding key "${key}" across mirrors. Each bound key must be unique.`,
            );
          }
          seen.add(key);
        }
      }
    };

    const persistDoc = async () => {
      if (!options.storage || !doc) return;
      try {
        const snapshot = doc.export({mode: 'snapshot'});
        await options.storage.save(snapshot);
      } catch (error) {
        options.onError?.(error);
      }
    };

    const pushFromStore = (state: S, mirrorsCfg: Array<CrdtMirror<S, any>>) => {
      if (mirrors.length === 0 || suppressStoreToMirror) return;
      for (let i = 0; i < mirrorsCfg.length; i += 1) {
        const mirror = mirrors[i];
        const cfg = mirrorsCfg[i];
        if (!cfg || !mirror) continue;

        const next: Record<string, unknown> = {};
        for (const binding of cfg.bindings as Array<CrdtBinding<S, any>>) {
          const value = binding.select
            ? binding.select(state)
            : (state as any)[binding.key];
          (next as any)[binding.key] = value;
        }

        const lastOutbound = lastOutboundByModule.get(i);
        if (
          lastOutbound &&
          (cfg.bindings as Array<CrdtBinding<S, any>>).every(
            (b) => (lastOutbound as any)[b.key] === (next as any)[b.key],
          )
        ) {
          continue;
        }

        console.debug(
          `[crdt] pushFromStore outbound keys (mirror ${i}):`,
          (cfg.bindings as Array<CrdtBinding<S, any>>).map((b) => b.key),
        );
        lastOutboundByModule.set(i, next);

        mirror.setState(
          (draft: any) => {
            Object.assign(draft, next);
          },
          {tags: ['from-store']},
        );
      }
      void persistDoc();
    };

    const applyMirrorToStore = (
      moduleBindings: Array<CrdtBinding<S, any>>,
      mirrorState: any,
      tags?: string[],
    ) => {
      if (tags?.includes('from-store')) return;
      suppressStoreToMirror = true;
      try {
        for (const binding of moduleBindings) {
          const value = mirrorState?.[binding.key];
          if (binding.apply) {
            binding.apply(value, set, get);
          } else {
            set({[binding.key]: value} as any);
          }
        }
      } finally {
        suppressStoreToMirror = false;
      }
      void persistDoc();
    };

    const initialize = async () => {
      // Idempotency: room stores (and React StrictMode in dev) can call initialize()
      // more than once. A second initialization without a prior destroy() would leak
      // subscriptions and can desync the sync connector from the active doc.
      if (initializing) return initializing;
      if (get().crdt?.status === 'ready' && doc && mirrors.length > 0) return;

      initializing = (async () => {
        try {
          const mirrorsCfg = getMirrors();
          validateBindings(mirrorsCfg);

          doc = options.doc ?? options.createDoc?.() ?? new LoroDoc();
          if (!doc) throw new Error('[crdt] Failed to create Loro doc');
          const activeDoc = doc;

          if (options.storage) {
            const snapshot = await options.storage.load();
            if (snapshot) {
              activeDoc.import(snapshot);
            }
          }

          mirrors = mirrorsCfg.map((m) => {
            return new Mirror<any>({
              doc: activeDoc,
              schema: m.schema as any,
              initialState: m.initialState,
              ...(m.mirrorOptions ?? options.mirrorOptions ?? {}),
            });
          });
          // Debug local doc updates to verify mirror.setState is producing CRDT ops.
          unsubDocLocal = doc.subscribeLocalUpdates?.((update: Uint8Array) => {
            console.debug(
              '[crdt] doc local update',
              update.byteLength,
              'bytes',
            );
          });

          // Subscribe mirror->store first so snapshot/imported state wins.
          unsubMirrors = mirrors.map((m, idx) => {
            const cfg = mirrorsCfg[idx];
            if (!cfg) {
              return () => {};
            }
            return m.subscribe((state: any, meta: any) => {
              applyMirrorToStore(cfg.bindings as any, state, meta?.tags);
            });
          });

          // Wait a tick so mirrors can emit any imported state, then align store once.
          await Promise.resolve();
          for (let i = 0; i < mirrors.length; i += 1) {
            const m = mirrors[i];
            const cfg = mirrorsCfg[i];
            if (!m || !cfg) continue;
            applyMirrorToStore(cfg.bindings as any, m.getState() as any, []);
          }
          // Now subscribe store->mirror for local changes.
          unsubStore = store.subscribe((state) => {
            pushFromStore(state, mirrorsCfg);
          });

          if (options.sync) {
            console.info('[crdt] initializing sync connector');
            await options.sync.connect(doc);
            console.info('[crdt] sync connector connected');
          }

          const prevCrdt = get().crdt;
          set({
            crdt: {
              ...(prevCrdt ?? {}),
              status: 'ready',
              error: undefined,
              initialize: prevCrdt?.initialize ?? initialize,
              destroy: prevCrdt?.destroy ?? destroy,
            },
          } as Partial<S & CrdtSliceState>);
        } catch (error: any) {
          options.onError?.(error);
          const prevCrdt = get().crdt;
          set({
            crdt: {
              ...(prevCrdt ?? {}),
              status: 'error',
              error: error?.message ?? 'Failed to initialize CRDT',
              initialize: prevCrdt?.initialize ?? initialize,
              destroy: prevCrdt?.destroy ?? destroy,
            },
          } as Partial<S & CrdtSliceState>);
        } finally {
          initializing = undefined;
        }
      })();

      return initializing;
    };

    const destroy = async () => {
      unsubStore?.();
      for (const unsub of unsubMirrors) unsub?.();
      unsubDocLocal?.();
      if (options.sync?.disconnect) {
        await options.sync.disconnect();
      }
      doc = undefined;
      mirrors = [];
      unsubMirrors = [];
      initializing = undefined;
      const prevCrdt = get().crdt;
      set({
        crdt: {
          ...(prevCrdt ?? {}),
          status: 'idle',
          error: undefined,
          initialize: prevCrdt?.initialize ?? initialize,
          destroy: prevCrdt?.destroy ?? destroy,
        },
      } as Partial<S & CrdtSliceState>);
    };

    return {
      crdt: {
        status: 'idle',
        initialize,
        destroy,
      },
    };
  });
}
