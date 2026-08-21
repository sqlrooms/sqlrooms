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
import {createAiSlice, type AiSliceState} from '../../src/AiSlice';

export type SessionTestState = BaseRoomStoreState & AiSliceState;

/** A store with one empty AI slice and no sessions. */
export function createSessionTestStore() {
  return createStore<SessionTestState>()((set, get, storeApi) => ({
    ...createBaseRoomSlice()(set, get, storeApi),
    ...createAiSlice({
      tools: {},
      getInstructions: () => 'test instructions',
      config: {sessions: []},
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
