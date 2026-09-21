import {jest} from '@jest/globals';
import type {ChatSessionSchema} from '@sqlrooms/ai-config';
import type {LanguageModel} from 'ai';
import {createStore} from 'zustand';
import {createAiSlice, type AiSliceState} from '../src/AiSlice';
import {AI_GENERATION_FAILED_TEXT} from '../src/constants';
import {generateSessionTitle} from '../src/hooks/useGenerateSessionTitle';

type SendPromptOptions = {onError?: (error: unknown) => void};

function sessionWithPrompt(text: string): ChatSessionSchema {
  return {
    id: 'session-1',
    name: 'Chat',
    uiMessages: [
      {
        id: 'm1',
        role: 'user',
        parts: [{type: 'text', text}],
      },
    ],
  } as unknown as ChatSessionSchema;
}

describe('generateSessionTitle', () => {
  it('keeps the default name when generation fails', async () => {
    const renameSession = jest.fn();
    // `sendPrompt` reports failure by resolving with a placeholder and
    // invoking `onError`, rather than throwing.
    const sendPrompt = (async (
      _prompt: string,
      options?: SendPromptOptions,
    ) => {
      options?.onError?.(new Error('model is down'));
      return AI_GENERATION_FAILED_TEXT;
    }) as unknown as Parameters<typeof generateSessionTitle>[0]['sendPrompt'];

    const result = await generateSessionTitle({
      session: sessionWithPrompt('how many places are in Paris?'),
      sendPrompt,
      renameSession,
    });

    expect(result).toEqual({status: 'generation-failed'});
    expect(renameSession).not.toHaveBeenCalled();
  });

  it('still renames when the model returns a real title', async () => {
    const renameSession = jest.fn();
    const sendPrompt = jest.fn().mockResolvedValue('Places in Paris');

    const result = await generateSessionTitle({
      session: sessionWithPrompt('how many places are in Paris?'),
      sendPrompt,
      renameSession,
    });

    expect(result).toEqual({status: 'renamed', title: 'Places in Paris'});
    expect(renameSession).toHaveBeenCalledWith('session-1', 'Places in Paris');
  });

  it('renames even when a successful response equals the failure placeholder', async () => {
    // A conversation about that wording can legitimately produce it as a
    // title. Failure is judged by `onError`, not by the response text, so
    // this is a real title and must be applied.
    const renameSession = jest.fn();
    const sendPrompt = (async () =>
      AI_GENERATION_FAILED_TEXT) as unknown as Parameters<
      typeof generateSessionTitle
    >[0]['sendPrompt'];

    const result = await generateSessionTitle({
      session: sessionWithPrompt('why does the assistant show this error?'),
      sendPrompt,
      renameSession,
    });

    expect(result).toEqual({
      status: 'renamed',
      title: AI_GENERATION_FAILED_TEXT,
    });
    expect(renameSession).toHaveBeenCalledWith(
      'session-1',
      AI_GENERATION_FAILED_TEXT,
    );
  });

  it('keeps the default name when the real sendPrompt hits a failing model', async () => {
    // End-to-end rather than mocked: drives the actual `sendPrompt`, so the
    // guard stays coupled to the value the slice really returns. A mock that
    // resolves the constant on its own would pass even if the two diverged.
    const failingModel = {
      specificationVersion: 'v3',
      provider: 'stub',
      modelId: 'stub-model',
      supportedUrls: {},
      doGenerate: async () => {
        throw new Error('model is down');
      },
      doStream: async () => {
        throw new Error('doStream is not used by generateText');
      },
    } as unknown as LanguageModel;

    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({
        tools: {},
        getInstructions: () => 'test instructions',
        defaultProvider: 'openai',
        defaultModel: 'shared-model',
        getCustomModel: () => failingModel,
      })(set, get, api),
    );

    const session = sessionWithPrompt('how many places are in Paris?');
    const renameSession = jest.fn();

    const result = await generateSessionTitle({
      session,
      sendPrompt: store.getState().ai.sendPrompt,
      renameSession,
    });

    expect(result).toEqual({status: 'generation-failed'});
    expect(renameSession).not.toHaveBeenCalled();
    expect(session.name).toBe('Chat');
  });
});
