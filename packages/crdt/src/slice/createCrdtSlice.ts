import {
  BaseRoomConfig,
  createSlice,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {LoroDoc} from 'loro-crdt';
import type {StateCreator} from 'zustand';

import {
  CrdtDocsSelection,
  CrdtSliceState,
  CreateCrdtSliceOptions,
} from '../types';

/**
 * Default selector: mirror the persisted config as a single CRDT document named "config".
 */
function defaultSelector(
  state: RoomShellSliceState<BaseRoomConfig>,
): CrdtDocsSelection {
  return {config: state.config};
}

function defaultIsEqual(prev: unknown, next: unknown): boolean {
  return Object.is(prev, next);
}

/**
 * Create a CRDT slice for a SQLRooms room store.
 *
 * The slice:
 * - creates and manages one or more Loro documents keyed by logical names
 * - subscribes to selected parts of the store and mirrors changes into the corresponding docs
 * - exposes an API to apply remote updates (`applyRemoteUpdate`)
 *
 * Usage:
 *   createCrdtSlice({
 *     selector: (state) => ({ config: state.config, canvas: state.config.canvas }),
 *   })(set, get, store)
 */
export function createCrdtSlice<
  PC extends BaseRoomConfig,
  TState extends CrdtSliceState & RoomShellSliceState<PC>,
>(options: CreateCrdtSliceOptions<PC, TState>): StateCreator<CrdtSliceState> {
  const selector = options?.selector ?? defaultSelector;
  const isEqual = options?.isEqual ?? defaultIsEqual;

  function writeJsonToDoc(doc: any, value: unknown) {
    const map = doc.getMap('state');
    map.set('data', value);
  }

  return createSlice<PC, CrdtSliceState>((set, get, store) => {
    const ensureDoc = (key: string) => {
      const st = get();
      const existing = st.crdt.docs[key];
      if (existing) return existing;
      const doc = new LoroDoc();
      set((state) =>
        produce(state, (draft) => {
          draft.crdt.docs[key] = doc;
        }),
      );
      options?.onDocCreated?.(key, doc);
      return doc;
    };

    let unsubscribeStore: (() => void) | undefined;

    return {
      crdt: {
        docs: {},
        applyRemoteUpdate: (key: string, update: Uint8Array) => {
          const doc = ensureDoc(key);
          // Import remote update bytes
          doc.import(update);
        },
        getDoc: (key: string) => {
          return ensureDoc(key);
        },
        encodeDocAsUpdate: (key: string) => {
          const doc = ensureDoc(key);
          // Export incremental update (best-effort default)
          return doc.export({mode: 'update'});
        },

        initialize: async () => {
          // Initial mirror
          const initialSelection = selector(store.getState() as any);
          for (const [key, value] of Object.entries(initialSelection)) {
            const doc = ensureDoc(key);
            writeJsonToDoc(doc, value);
          }

          // Networking is handled by createSyncSlice

          // Subscribe to store and mirror changes into docs
          unsubscribeStore = store.subscribe((nextState, prevState) => {
            const nextSelection = selector(nextState as any);
            const prevSelection = selector(prevState as any) || {};

            // Handle updated and new keys
            for (const [key, nextVal] of Object.entries(nextSelection)) {
              const prevVal = prevSelection[key];
              if (!isEqual(prevVal, nextVal, key)) {
                const doc = ensureDoc(key);
                writeJsonToDoc(doc, nextVal);
              }
            }
          });
        },

        teardown: () => {
          if (unsubscribeStore) {
            unsubscribeStore();
            unsubscribeStore = undefined;
          }
        },
      },
    };
  });
}
