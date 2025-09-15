import type {StoreApi} from 'zustand';
// Prefer real Loro types; fallback to local shim for type safety
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import type {LoroDoc} from 'loro-crdt';

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
   * Default: (state) => ({ config: state.config })
   */
  selector?: (state: TState) => CrdtDocsSelection;

  /**
   * Optional hook invoked after a Loro document is created for a key.
   */
  onDocCreated?: (key: string, doc: LoroDoc) => void;

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
    /** Plain object of logical key -> Loro document */
    docs: Record<string, LoroDoc>;

    /**
     * Apply a CRDT update coming from a remote source to the corresponding Loro doc.
     */
    applyRemoteUpdate: (key: string, update: Uint8Array) => void;

    /**
     * Get or lazily create a LoroDoc for the given logical key.
     */
    getDoc: (key: string) => LoroDoc;

    /**
     * Encode the current state of a doc as a Loro export (bytes) for persistence or syncing.
     */
    encodeDocAsUpdate: (key: string) => Uint8Array;

    /**
     * Stop any subscriptions/observers created by the slice.
     */
    teardown: () => void;

    /**
     * Initialize the connector (creates a WasmDuckDbConnector if none exists)
     */
    initialize: () => Promise<void>;
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
