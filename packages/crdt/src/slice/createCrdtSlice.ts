import {produce} from 'immer';
import type {StateCreator, StoreApi} from 'zustand';
import * as Y from 'yjs';
import {
  CrdtDocsSelection,
  CrdtSliceInternals,
  CrdtSliceState,
  CreateCrdtSliceOptions,
} from '../types';

/**
 * Default selector: mirror the persisted config as a single CRDT document named "config".
 */
function defaultSelector<TState>(state: TState): CrdtDocsSelection {
  return {config: (state as any).config};
}

function defaultIsEqual(prev: unknown, next: unknown): boolean {
  return Object.is(prev, next);
}

/**
 * Create a CRDT slice for a SQLRooms room store.
 *
 * The slice:
 * - creates and manages one or more Yjs documents keyed by logical names
 * - subscribes to selected parts of the store and mirrors changes into the corresponding docs
 * - exposes an API to apply remote updates (`applyRemoteUpdate`)
 *
 * Usage:
 *   createCrdtSlice({
 *     selector: (state) => ({ config: state.config, canvas: state.config.canvas }),
 *   })(set, get, store)
 */
export function createCrdtSlice<TState>(
  options?: CreateCrdtSliceOptions<TState>,
): StateCreator<TState & CrdtSliceState> {
  const selector = options?.selector ?? defaultSelector<TState>;
  const isEqual = options?.isEqual ?? defaultIsEqual;

  // Internals are kept outside of Zustand state to avoid serialization and change noise
  const internals: CrdtSliceInternals<TState> = {
    // initialized later
    storeApi: undefined as unknown as StoreApi<TState>,
  };

  function ensureDoc(state: TState & CrdtSliceState, key: string): Y.Doc {
    const existing = state.crdt.docs.get(key);
    if (existing) return existing;
    const doc = new Y.Doc();
    state.crdt.docs.set(key, doc);
    options?.onDocCreated?.(key, doc);
    return doc;
  }

  function writeJsonToDoc(doc: Y.Doc, value: unknown) {
    const root = doc.getMap('state');
    // Store the entire JSON under a single key to keep implementation simple.
    // Apps that need granular diffs can replace this with a custom mapping.
    root.set('data', value as any);
  }

  return (set, get, store) => {
    // Seed crdt state
    const slice: CrdtSliceState = {
      crdt: {
        docs: new Map<string, Y.Doc>(),
        applyRemoteUpdate: (key: string, update: Uint8Array) => {
          const doc = ensureDoc(get() as TState & CrdtSliceState, key);
          Y.applyUpdate(doc, update, 'remote');
        },
        getDoc: (key: string) => {
          return ensureDoc(get() as TState & CrdtSliceState, key);
        },
        encodeDocAsUpdate: (key: string) => {
          const doc = ensureDoc(get() as TState & CrdtSliceState, key);
          return Y.encodeStateAsUpdate(doc);
        },
        teardown: () => {
          if (internals.unsubscribeStore) {
            internals.unsubscribeStore();
            internals.unsubscribeStore = undefined;
          }
        },
      },
    };

    // Merge slice into state
    set(
      produce((draft: any) => {
        Object.assign(draft, slice);
      }),
    );

    // Wire internals
    internals.storeApi = store as unknown as StoreApi<TState>;

    // Initial mirror
    const initialSelection = selector(store.getState() as unknown as TState);
    internals.prevSelection = initialSelection;
    for (const [key, value] of Object.entries(initialSelection)) {
      const doc = ensureDoc(get() as TState & CrdtSliceState, key);
      writeJsonToDoc(doc, value);
    }

    // Subscribe to store and mirror changes into docs
    internals.unsubscribeStore = store.subscribe((nextState) => {
      const nextSelection = selector(nextState as unknown as TState);

      const prev = internals.prevSelection ?? {};

      // Handle updated and new keys
      for (const [key, nextVal] of Object.entries(nextSelection)) {
        const prevVal = (prev as any)[key];
        if (!isEqual(prevVal, nextVal, key)) {
          const doc = ensureDoc(get() as TState & CrdtSliceState, key);
          writeJsonToDoc(doc, nextVal);
        }
      }

      // Handle removed keys: destroy docs to free memory
      for (const key of Object.keys(prev)) {
        if (!(key in nextSelection)) {
          const st = get() as TState & CrdtSliceState;
          const doc = st.crdt.docs.get(key);
          if (doc) {
            doc.destroy();
            st.crdt.docs.delete(key);
          }
        }
      }

      internals.prevSelection = nextSelection;
    });

    return slice as unknown as TState & CrdtSliceState;
  };
}
