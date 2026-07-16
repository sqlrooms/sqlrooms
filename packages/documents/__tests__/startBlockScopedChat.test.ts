import {jest} from '@jest/globals';
import type {StartBlockScopedChatActions} from '../src/startBlockScopedChat';

const toastError = jest.fn();

jest.unstable_mockModule('@sqlrooms/ui', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const {startBlockScopedChat} = await import('../src/startBlockScopedChat');

function createActions(
  overrides: Partial<StartBlockScopedChatActions> = {},
): StartBlockScopedChatActions {
  const draftIds = new Map<string, string[]>();
  const setSessionDraftContextItemIds = jest.fn(
    (sessionId: string, ids: string[]) => {
      draftIds.set(sessionId, ids);
    },
  );
  return {
    getArtifact: () => ({type: 'block-document'}),
    getCurrentArtifactId: () => 'doc-1',
    setCurrentArtifact: jest.fn(),
    getAiSessions: () => [],
    getAiSessionArtifacts: () => ({}),
    createArtifactScopedSession: () => 'session-1',
    switchSession: jest.fn(),
    getSessionDraftContextItemIds: (sessionId) => draftIds.get(sessionId),
    setSessionDraftContextItemIds,
    setPrompt: jest.fn(),
    startAnalysisWhenReady: jest.fn(async () => true),
    ...overrides,
  };
}

describe('startBlockScopedChat', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('creates a session, seeds context, and starts analysis', async () => {
    const actions = createActions();
    const revealAssistant = jest.fn();

    await startBlockScopedChat({
      target: {
        blockDocumentId: 'doc-1',
        blockId: 'block-1',
        blockType: 'map',
        blockInstanceId: 'map-1',
      },
      prompt: 'make it blue',
      revealAssistant,
      actions,
      isValidBlockDocumentArtifact: (artifact) =>
        artifact.type === 'block-document',
    });

    expect(revealAssistant).toHaveBeenCalled();
    expect(actions.setPrompt).toHaveBeenCalledWith('session-1', 'make it blue');
    expect(actions.startAnalysisWhenReady).toHaveBeenCalledWith('session-1');
    expect(actions.getSessionDraftContextItemIds('session-1')).toEqual([
      'block:doc-1:block-1',
    ]);
  });

  it('rejects invalid artifacts', async () => {
    const actions = createActions({
      getArtifact: () => ({type: 'other'}),
    });

    await startBlockScopedChat({
      target: {
        blockDocumentId: 'doc-1',
        blockId: 'block-1',
        blockType: 'map',
      },
      prompt: 'hello',
      revealAssistant: jest.fn(),
      actions,
      isValidBlockDocumentArtifact: (artifact) =>
        artifact.type === 'block-document',
    });

    expect(toastError).toHaveBeenCalled();
    expect(actions.startAnalysisWhenReady).not.toHaveBeenCalled();
  });

  it('reuses a finished session instead of treating it as already running', async () => {
    const contextItemId = 'block:doc-1:block-1';
    const actions = createActions({
      getAiSessions: () => [
        {
          id: 'finished-session',
          isRunning: false,
          lastOpenedAt: 2,
          draftContextItemIds: [contextItemId],
        },
      ],
      getAiSessionArtifacts: () => ({
        'finished-session': 'doc-1',
      }),
      getSessionDraftContextItemIds: (sessionId) =>
        sessionId === 'finished-session' ? [contextItemId] : undefined,
      createArtifactScopedSession: jest.fn(() => 'should-not-create'),
    });
    const revealAssistant = jest.fn();

    await startBlockScopedChat({
      target: {
        blockDocumentId: 'doc-1',
        blockId: 'block-1',
        blockType: 'map',
      },
      prompt: 'recolor these points',
      revealAssistant,
      actions,
      isValidBlockDocumentArtifact: (artifact) =>
        artifact.type === 'block-document',
    });

    expect(toastError).not.toHaveBeenCalled();
    expect(actions.switchSession).toHaveBeenCalledWith('finished-session');
    expect(actions.createArtifactScopedSession).not.toHaveBeenCalled();
    expect(actions.setSessionDraftContextItemIds).not.toHaveBeenCalled();
    expect(revealAssistant).toHaveBeenCalled();
    expect(actions.setPrompt).toHaveBeenCalledWith(
      'finished-session',
      'recolor these points',
    );
    expect(actions.startAnalysisWhenReady).toHaveBeenCalledWith(
      'finished-session',
    );
  });

  it('blocks when a matching session is already running', async () => {
    const contextItemId = 'block:doc-1:block-1';
    const actions = createActions({
      getAiSessions: () => [
        {
          id: 'running-session',
          isRunning: true,
          lastOpenedAt: 2,
          draftContextItemIds: [contextItemId],
        },
      ],
      getAiSessionArtifacts: () => ({
        'running-session': 'doc-1',
      }),
      createArtifactScopedSession: jest.fn(() => 'should-not-create'),
    });
    const revealAssistant = jest.fn();

    await startBlockScopedChat({
      target: {
        blockDocumentId: 'doc-1',
        blockId: 'block-1',
        blockType: 'map',
      },
      prompt: 'recolor these points',
      revealAssistant,
      actions,
      isValidBlockDocumentArtifact: (artifact) =>
        artifact.type === 'block-document',
    });

    expect(toastError).toHaveBeenCalledWith(
      'An AI chat is already running for this block',
    );
    expect(actions.switchSession).toHaveBeenCalledWith('running-session');
    expect(revealAssistant).not.toHaveBeenCalled();
    expect(actions.setPrompt).not.toHaveBeenCalled();
    expect(actions.startAnalysisWhenReady).not.toHaveBeenCalled();
  });
});
