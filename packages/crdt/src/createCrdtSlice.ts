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

export function createCrdtSlice<
  S extends Record<string, any>,
  TSchema extends SchemaType,
>(
  options: CreateCrdtSliceOptions<S, TSchema>,
): StateCreator<S & CrdtSliceState> {
  return (set, get, store) => {
    let doc: LoroDoc | undefined;
    let mirror: Mirror<TSchema> | undefined;
    let unsubStore: (() => void) | undefined;
    let unsubMirror: (() => void) | undefined;
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
            set((state: any) => ({...state, [binding.key]: value}));
          }
        }
      } finally {
        suppressStoreToMirror = false;
      }
      void persistDoc();
    };

    const initialize = async () => {
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

        // Subscribe mirror->store first so snapshot/imported state wins.
        unsubMirror = mirror.subscribe((state, meta) => {
          applyMirrorToStore(state as InferredState<TSchema>, meta?.tags);
        });
        // Wait a tick so mirror can emit any imported state, then align store once.
        await Promise.resolve();
        applyMirrorToStore(mirror.getState() as InferredState<TSchema>, []);
        // Now subscribe store->mirror for local changes.
        unsubStore = (store as StoreApi<S>).subscribe((state) => {
          pushFromStore(state);
        });

        if (options.sync) {
          await options.sync.connect(doc);
        }

        set((state: any) => ({
          ...state,
          crdt: {
            ...(state.crdt ?? {}),
            status: 'ready',
            error: undefined,
            initialize: state.crdt?.initialize ?? initialize,
            destroy: state.crdt?.destroy ?? destroy,
          },
        }));
      } catch (error: any) {
        options.onError?.(error);
        set((state: any) => ({
          ...state,
          crdt: {
            ...(state.crdt ?? {}),
            status: 'error',
            error: error?.message ?? 'Failed to initialize CRDT',
            initialize: state.crdt?.initialize ?? initialize,
            destroy: state.crdt?.destroy ?? destroy,
          },
        }));
      }
    };

    const destroy = async () => {
      unsubStore?.();
      unsubMirror?.();
      if (options.sync?.disconnect) {
        await options.sync.disconnect();
      }
    };

    return {
      crdt: {
        status: 'idle',
        initialize,
        destroy,
      },
    } as unknown as S & CrdtSliceState;
  };
}
