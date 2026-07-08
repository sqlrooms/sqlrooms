import {jest} from '@jest/globals';
import {blockContextItemId, type BlockAiTarget} from '@sqlrooms/documents';

const toastError = jest.fn();
let mockState: ReturnType<typeof createState>;

jest.unstable_mockModule('@sqlrooms/ui', () => ({
  toast: {
    error: toastError,
  },
}));

jest.unstable_mockModule('../../store', () => ({
  useRoomStore: {
    getState: () => mockState,
  },
}));

const {startBlockScopedChat} = await import('../startBlockScopedChat');

const target: BlockAiTarget = {
  blockDocumentId: 'worksheet-1',
  blockId: 'chart-block',
  blockType: 'chart',
};
const contextItemId = blockContextItemId(target);

function createState({isRunning}: {isRunning: boolean}) {
  return {
    artifacts: {
      config: {
        currentArtifactId: 'worksheet-1',
      },
      getArtifact: jest.fn(() => ({
        id: 'worksheet-1',
        type: 'worksheet',
        title: 'Worksheet',
      })),
      setCurrentArtifact: jest.fn(),
    },
    artifactAi: {
      config: {
        aiSessionArtifacts: {
          'session-1': 'worksheet-1',
        },
      },
      createArtifactScopedSession: jest.fn(() => 'new-session'),
    },
    ai: {
      config: {
        sessions: [
          {
            id: 'session-1',
            isRunning,
            lastOpenedAt: 1,
            draftContextItemIds: [contextItemId],
          },
        ],
      },
      switchSession: jest.fn(),
      getSessionDraftContextItemIds: jest.fn(() => [contextItemId]),
      setSessionDraftContextItemIds: jest.fn(),
      setPrompt: jest.fn(),
      startAnalysisWhenReady: jest.fn(async () => true),
    },
  };
}

describe('startBlockScopedChat', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('reuses a finished block session for follow-up prompts', async () => {
    mockState = createState({isRunning: false});
    const revealAssistant = jest.fn();

    await startBlockScopedChat({
      target,
      prompt: 'Make the chart blue',
      revealAssistant,
    });

    expect(toastError).not.toHaveBeenCalledWith(
      'An AI chat is already running for this block',
    );
    expect(mockState.ai.switchSession).toHaveBeenCalledWith('session-1');
    expect(revealAssistant).toHaveBeenCalled();
    expect(mockState.ai.setPrompt).toHaveBeenCalledWith(
      'session-1',
      'Make the chart blue',
    );
    expect(mockState.ai.startAnalysisWhenReady).toHaveBeenCalledWith(
      'session-1',
    );
    expect(
      mockState.artifactAi.createArtifactScopedSession,
    ).not.toHaveBeenCalled();
  });

  it('blocks only while the matching block session is running', async () => {
    mockState = createState({isRunning: true});
    const revealAssistant = jest.fn();

    await startBlockScopedChat({
      target,
      prompt: 'Make the chart blue',
      revealAssistant,
    });

    expect(toastError).toHaveBeenCalledWith(
      'An AI chat is already running for this block',
    );
    expect(mockState.ai.switchSession).toHaveBeenCalledWith('session-1');
    expect(revealAssistant).not.toHaveBeenCalled();
    expect(mockState.ai.startAnalysisWhenReady).not.toHaveBeenCalled();
  });
});
