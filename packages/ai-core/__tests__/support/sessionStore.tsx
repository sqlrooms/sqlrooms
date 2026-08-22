/**
 * A minimal room store carrying the AI slice, for session-mode tests.
 *
 * Safe to import statically alongside a mocked `ChatRuntimeContext`:
 * `AiSlice` reaches no `components/` module, so loading it here cannot pull
 * the real runtime context in ahead of the mock.
 */
import {jest} from '@jest/globals';
import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  createAiSlice,
  type AiSliceOptions,
  type AiSliceState,
} from '../../src/AiSlice';

export type SessionTestState = BaseRoomStoreState & AiSliceState;

/**
 * A store with one empty AI slice and no sessions.
 *
 * @param options - Slice options to override, e.g. `getCustomModel` for the
 *   server-side-proxy case where no browser-held API key exists.
 */
export function createSessionTestStore(options: Partial<AiSliceOptions> = {}) {
  return createStore<SessionTestState>()((set, get, storeApi) => ({
    ...createBaseRoomSlice()(set, get, storeApi),
    ...createAiSlice({
      tools: {},
      getInstructions: () => 'test instructions',
      config: {sessions: []},
      ...options,
    })(set, get, storeApi),
  }));
}

export type SessionTestStore = ReturnType<typeof createSessionTestStore>;

/**
 * Replaces the two heavy, network-touching actions with spies, so tests can
 * assert on session-creation and run-triggering behavior without exercising
 * the real model/transport pipeline.
 */
export function stubAnalysisActions(store: SessionTestStore) {
  const startAnalysis = jest.fn<(sessionId: string) => Promise<void>>(
    async () => {},
  );
  const startAnalysisWhenReady = jest.fn<
    (sessionId: string) => Promise<boolean>
  >(async () => true);
  store.setState((state) => ({
    ai: {...state.ai, startAnalysis, startAnalysisWhenReady},
  }));
  return {startAnalysis, startAnalysisWhenReady};
}
