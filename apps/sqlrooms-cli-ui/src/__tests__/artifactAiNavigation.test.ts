import {jest} from '@jest/globals';
import type {StoreApi} from 'zustand';
import {switchToArtifactAiSession} from '../artifactAiNavigation';
import type {RoomState} from '../store-types';

function createMockStore({
  sessionIds = ['session-1'],
  sessionArtifactId = 'worksheet-1',
  artifactExists = true,
}: {
  sessionIds?: string[];
  sessionArtifactId?: string;
  artifactExists?: boolean;
} = {}) {
  const calls: string[] = [];
  const setCurrentArtifact = jest.fn((artifactId: string) => {
    calls.push(`artifact:${artifactId}`);
  });
  const switchSession = jest.fn((sessionId: string) => {
    calls.push(`session:${sessionId}`);
  });
  const state = {
    ai: {
      config: {
        sessions: sessionIds.map((id) => ({id})),
      },
      switchSession,
    },
    artifactAi: {
      getSessionArtifactId: () => sessionArtifactId,
    },
    artifacts: {
      getArtifact: (artifactId: string) =>
        artifactExists ? {id: artifactId, type: 'worksheet'} : undefined,
      setCurrentArtifact,
    },
  } as unknown as RoomState;

  return {
    calls,
    setCurrentArtifact,
    store: {
      getState: () => state,
    } as StoreApi<RoomState>,
    switchSession,
  };
}

describe('switchToArtifactAiSession', () => {
  it('selects the owning artifact before switching sessions', () => {
    const {calls, setCurrentArtifact, store, switchSession} = createMockStore();

    expect(switchToArtifactAiSession(store, 'session-1')).toBe(true);

    expect(setCurrentArtifact).toHaveBeenCalledWith('worksheet-1');
    expect(switchSession).toHaveBeenCalledWith('session-1');
    expect(calls).toEqual(['artifact:worksheet-1', 'session:session-1']);
  });

  it('switches the session without artifact navigation when ownership is stale', () => {
    const {calls, setCurrentArtifact, store, switchSession} = createMockStore({
      artifactExists: false,
    });

    expect(switchToArtifactAiSession(store, 'session-1')).toBe(true);

    expect(setCurrentArtifact).not.toHaveBeenCalled();
    expect(switchSession).toHaveBeenCalledWith('session-1');
    expect(calls).toEqual(['session:session-1']);
  });

  it('does nothing for an unknown session', () => {
    const {calls, setCurrentArtifact, store, switchSession} = createMockStore();

    expect(switchToArtifactAiSession(store, 'missing-session')).toBe(false);

    expect(setCurrentArtifact).not.toHaveBeenCalled();
    expect(switchSession).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});
