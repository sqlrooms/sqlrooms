import {setAutoFreeze} from 'immer';
import {LoroDoc} from 'loro-crdt';
import {InferInputType, Mirror, SchemaType, schema} from 'loro-mirror';
import {StateCreator} from 'zustand';
import {
  InferredState,
  MirrorSchema,
  StoreGet,
  StoreSet,
  StripCidDeep,
  createSlice,
} from './type-helpers';

// Mirror can’t stamp $cid on frozen objects, so disable auto-freeze.
setAutoFreeze(false);

export type CrdtMirrorValueSelector<S, TSchema extends SchemaType> = (
  state: S,
) => StripCidDeep<InferredState<TSchema>>;

export type CrdtMirrorValueApplier<S, TSchema extends SchemaType> = (
  value: InferredState<TSchema>,
  set: StoreSet<S>,
  get: StoreGet<S>,
) => void;

export type CrdtDocStorage = {
  load: () => Promise<Uint8Array | undefined>;
  save: (data: Uint8Array) => Promise<void>;
};

export type CrdtSyncConnector = {
  connect: (doc: LoroDoc) => Promise<void>;
  disconnect?: () => Promise<void>;
};

export type CrdtMirror<S, TSchema extends SchemaType = SchemaType> = {
  /**
   * Schema for the value stored under this mirror's key in the Loro doc.
   *
   * Example: if the mirror key is `"canvas"`, this schema describes the value at
   * `doc.root.canvas` (not an extra `{canvas: ...}` wrapper).
   */
  schema: MirrorSchema<TSchema>;
  /**
   * Select the value to write under this mirror key.
   *
   * If omitted, the store field at the same key name will be mirrored.
   */
  select?: CrdtMirrorValueSelector<S, TSchema>;
  /**
   * Apply an incoming CRDT value under this mirror key back into the store.
   *
   * If omitted, the store field at the same key name will be replaced.
   */
  apply?: CrdtMirrorValueApplier<S, TSchema>;
  /**
   * Initial value written under this mirror key when creating the Mirror.
   */
  initialState?: Partial<InferInputType<TSchema>>;
  mirrorOptions?: Record<string, unknown>;
};

export type CreateCrdtSliceOptions<S, TSchema extends SchemaType> = {
  /**
   * CRDT mirrors keyed by their root key in the Loro document.
   *
   * Each entry becomes one `loro-mirror` `Mirror` instance on a shared `LoroDoc`.
   */
  mirrors: Record<string, CrdtMirror<S, any>>;
  doc?: LoroDoc;
  createDoc?: () => LoroDoc;
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
  TSchema extends SchemaType = SchemaType,
>(options: CreateCrdtSliceOptions<S, TSchema>): StateCreator<CrdtSliceState> {
  return createSlice<CrdtSliceState, S & CrdtSliceState>((set, get, store) => {
    let doc: LoroDoc | undefined;
    let mirrors: Mirror<any>[] = [];
    let mirrorKeys: string[] = [];
    let unsubStore: (() => void) | undefined;
    let unsubMirrors: Array<() => void> = [];
    let unsubDocLocal: (() => void) | undefined;
    let initializing: Promise<void> | undefined;
    let suppressStoreToMirror = false;
    const lastOutboundByKey = new Map<string, unknown>();

    const persistDoc = async () => {
      if (!options.storage || !doc) return;
      try {
        const snapshot = doc.export({mode: 'snapshot'});
        await options.storage.save(snapshot);
      } catch (error) {
        options.onError?.(error);
      }
    };

    const pushFromStore = (state: S) => {
      if (mirrors.length === 0 || suppressStoreToMirror) return;
      for (let i = 0; i < mirrors.length; i += 1) {
        const mirror = mirrors[i];
        const key = mirrorKeys[i];
        if (!mirror || !key) continue;
        const cfg = options.mirrors[key];
        if (!cfg) continue;

        const value = cfg.select ? cfg.select(state) : (state as any)[key];

        const lastOutbound = lastOutboundByKey.get(key);
        if (lastOutbound === value) continue;

        console.debug(`[crdt] pushFromStore outbound key:`, key);
        lastOutboundByKey.set(key, value);

        mirror.setState(
          (draft: any) => {
            draft[key] = value;
          },
          {tags: ['from-store']},
        );
      }
      void persistDoc();
    };

    const applyMirrorToStore = (
      key: string,
      cfg: CrdtMirror<S, any>,
      mirrorState: any,
      tags?: string[],
    ) => {
      if (tags?.includes('from-store')) return;
      suppressStoreToMirror = true;
      try {
        const value = mirrorState?.[key];
        if (cfg.apply) {
          cfg.apply(value, set, get);
        } else {
          set({[key]: value} as any);
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
          mirrorKeys = Object.keys(options.mirrors);
          if (mirrorKeys.length === 0) {
            throw new Error('[crdt] `mirrors` must have at least one entry.');
          }

          doc = options.doc ?? options.createDoc?.() ?? new LoroDoc();
          if (!doc) throw new Error('[crdt] Failed to create Loro doc');
          const activeDoc = doc;

          if (options.storage) {
            const snapshot = await options.storage.load();
            if (snapshot) {
              activeDoc.import(snapshot);
            }
          }

          mirrors = mirrorKeys.map((key) => {
            const cfg = options.mirrors[key];
            if (!cfg)
              throw new Error(`[crdt] Missing mirror config for "${key}".`);

            // Wrap per-mirror schema/value under its root key.
            const rootSchema = schema({[key]: cfg.schema as any} as any);
            const initialState = cfg.initialState
              ? ({[key]: cfg.initialState} as any)
              : undefined;

            return new Mirror<any>({
              doc: activeDoc,
              schema: rootSchema as any,
              initialState,
              ...(cfg.mirrorOptions ?? options.mirrorOptions ?? {}),
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
            const key = mirrorKeys[idx];
            if (!key) return () => {};
            const cfg = options.mirrors[key];
            if (!cfg) return () => {};
            return m.subscribe((state: any, meta: any) =>
              applyMirrorToStore(key, cfg, state, meta?.tags),
            );
          });

          // Wait a tick so mirrors can emit any imported state, then align store once.
          await Promise.resolve();
          for (let i = 0; i < mirrors.length; i += 1) {
            const m = mirrors[i];
            const key = mirrorKeys[i];
            if (!m || !key) continue;
            const cfg = options.mirrors[key];
            if (!cfg) continue;
            applyMirrorToStore(key, cfg, m.getState() as any, []);
          }
          // Now subscribe store->mirror for local changes.
          unsubStore = store.subscribe((state) => {
            pushFromStore(state);
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
      mirrorKeys = [];
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
