import type {StoreApi} from 'zustand';
import type * as Y from 'yjs';

/**
 * Describes the shape of the docs mapping returned by the selector.
 * Keys are logical document names, values are the selected state parts to mirror into CRDT docs.
 */
export type CrdtDocsSelection = Record<string, unknown>;

/**
 * Options for createCrdtSlice
 */
export interface CreateCrdtSliceOptions<TState> {
  /**
   * Select which parts of the Zustand room state should be mirrored into CRDT documents.
   * Default: (state) => ({ config: (state as any).config })
   */
  selector?: (state: TState) => CrdtDocsSelection;

  /**
   * Optional hook invoked after a Yjs Doc is created for a key.
   */
  onDocCreated?: (key: string, doc: Y.Doc) => void;

  /**
   * Optional equality check to avoid producing CRDT updates when selected slices are deep-equal.
   * If not provided, a shallow reference comparison per key is used.
   */
  isEqual?: (prev: unknown, next: unknown, key: string) => boolean;
}

/**
 * Runtime state and actions exposed by the CRDT slice.
 */
export interface CrdtSliceState {
  crdt: {
    /** Map of logical key -> Yjs document */
    docs: Map<string, Y.Doc>;

    /**
     * Apply a CRDT update coming from a remote source to the corresponding Yjs doc.
     * Implementations should pass origin = "remote" when applying.
     */
    applyRemoteUpdate: (key: string, update: Uint8Array) => void;

    /**
     * Get or lazily create a Y.Doc for the given logical key.
     */
    getDoc: (key: string) => Y.Doc;

    /**
     * Encode the current state of a doc as a Yjs update for persistence or syncing.
     */
    encodeDocAsUpdate: (key: string) => Uint8Array;

    /**
     * Stop any subscriptions/observers created by the slice.
     */
    teardown: () => void;
  };
}

/**
 * Internal subscriptions managed by the slice, held outside of the Zustand state tree.
 */
export interface CrdtSliceInternals<TState> {
  storeApi: StoreApi<TState>;
  unsubscribeStore?: () => void;
  prevSelection?: CrdtDocsSelection;
}
