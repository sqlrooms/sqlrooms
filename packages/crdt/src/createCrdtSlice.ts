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

export type CreateCrdtSliceOptions<S, TSchema extends SchemaType> = {
  schema: MirrorSchema<TSchema>;
  bindings: CrdtBinding<S, InferredState<TSchema>>[];
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
    let mirror: Mirror<TSchema> | undefined;
    let unsubStore: (() => void) | undefined;
    let unsubMirror: (() => void) | undefined;
    let unsubDocLocal: (() => void) | undefined;
    let initializing: Promise<void> | undefined;
    let suppressStoreToMirror = false;
    let lastOutbound: Partial<InferredState<TSchema>> | undefined;

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
      if (!mirror || suppressStoreToMirror) return;
      const next: Partial<InferredState<TSchema>> = {};
      for (const binding of options.bindings) {
        const value = binding.select
          ? binding.select(state)
          : (state as any)[binding.key];
        (next as any)[binding.key] = value;
      }
      // Skip if outbound payload is identical by reference per key
      if (
        lastOutbound &&
        options.bindings.every(
          (b) => (lastOutbound as any)[b.key] === (next as any)[b.key],
        )
      ) {
        return;
      }
      // Debug visibility for outbound updates to the CRDT mirror/doc.
      // Helps detect when local state changes are not producing CRDT traffic.
      console.debug(
        '[crdt] pushFromStore outbound keys:',
        options.bindings.map((b) => b.key),
      );
      lastOutbound = next;

      mirror.setState(
        (draft: any) => {
          Object.assign(draft, next);
        },
        {tags: ['from-store']},
      );
      void persistDoc();
    };

    const applyMirrorToStore = (
      mirrorState: InferredState<TSchema>,
      tags?: string[],
    ) => {
      if (tags?.includes('from-store')) return;
      suppressStoreToMirror = true;
      try {
        for (const binding of options.bindings) {
          const value = (mirrorState as any)[binding.key];
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
      if (get().crdt?.status === 'ready' && doc && mirror) return;

      initializing = (async () => {
        try {
          doc = options.doc ?? options.createDoc?.() ?? new LoroDoc();

          if (options.storage) {
            const snapshot = await options.storage.load();
            if (snapshot) {
              doc.import(snapshot);
            }
          }

          mirror = new Mirror<TSchema>({
            doc,
            schema: options.schema as any,
            initialState: options.initialState,
            ...(options.mirrorOptions ?? {}),
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
          unsubMirror = mirror.subscribe((state, meta) => {
            applyMirrorToStore(state as InferredState<TSchema>, meta?.tags);
          });
          // Wait a tick so mirror can emit any imported state, then align store once.
          await Promise.resolve();
          applyMirrorToStore(mirror.getState() as InferredState<TSchema>, []);
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
      unsubMirror?.();
      unsubDocLocal?.();
      if (options.sync?.disconnect) {
        await options.sync.disconnect();
      }
      doc = undefined;
      mirror = undefined;
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
