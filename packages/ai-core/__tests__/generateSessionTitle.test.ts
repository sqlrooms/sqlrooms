import {jest} from '@jest/globals';
import type {ChatSessionSchema} from '@sqlrooms/ai-config';
import type {LanguageModel} from 'ai';
import {createSessionTestStore} from './support/sessionStore';
import {AI_GENERATION_FAILED_TEXT} from '../src/constants';
import {
  generateSessionTitle,
  isDefaultGeneratedSessionName,
  UNTITLED_SESSION_NAME,
} from '../src/hooks/useGenerateSessionTitle';

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

/** A store whose model always fails, to drive `sendPrompt`'s real error path. */
function storeWithFailingModel() {
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

  return createSessionTestStore({
    defaultProvider: 'openai',
    defaultModel: 'shared-model',
    getCustomModel: () => failingModel,
  });
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

    expect(result).toEqual({
      status: 'generation-failed',
      title: UNTITLED_SESSION_NAME,
    });
    expect(renameSession).toHaveBeenCalledWith(
      'session-1',
      UNTITLED_SESSION_NAME,
    );
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
    const store = storeWithFailingModel();

    const session = sessionWithPrompt('how many places are in Paris?');
    const renameSession = jest.fn();

    const result = await generateSessionTitle({
      session,
      sendPrompt: store.getState().ai.sendPrompt,
      renameSession,
    });

    expect(result).toEqual({
      status: 'generation-failed',
      title: UNTITLED_SESSION_NAME,
    });
    expect(renameSession).toHaveBeenCalledWith(
      'session-1',
      UNTITLED_SESSION_NAME,
    );
  });

  it('survives a caller onError callback that throws', async () => {
    // `sendPrompt` documents that it resolves with a placeholder instead of
    // throwing. A host callback must not be able to break that contract and
    // turn the failure into a rejection.
    const store = storeWithFailingModel();
    const renameSession = jest.fn();

    const result = await generateSessionTitle({
      session: sessionWithPrompt('how many places are in Paris?'),
      sendPrompt: store.getState().ai.sendPrompt,
      renameSession,
      getPromptOptions: () => ({
        onError: () => {
          throw new Error('host callback blew up');
        },
      }),
    });

    expect(result).toEqual({
      status: 'generation-failed',
      title: UNTITLED_SESSION_NAME,
    });
  });

  it('numbers the fallback so two failures do not share a name', async () => {
    const store = storeWithFailingModel();
    const renameSession = jest.fn();

    const result = await generateSessionTitle({
      session: sessionWithPrompt('how many places are in Paris?'),
      sendPrompt: store.getState().ai.sendPrompt,
      renameSession,
      existingSessionNames: [UNTITLED_SESSION_NAME],
    });

    expect(result).toEqual({
      status: 'generation-failed',
      title: 'Untitled Chat 1',
    });
    expect(renameSession).toHaveBeenCalledWith('session-1', 'Untitled Chat 1');
  });

  it('leaves the fallback name eligible for a later retry', async () => {
    // The whole point of the fallback: a transient failure must not cost the
    // chat its chance at a real title on the next message.
    expect(isDefaultGeneratedSessionName(UNTITLED_SESSION_NAME)).toBe(true);
    expect(isDefaultGeneratedSessionName('Untitled Chat 1')).toBe(true);
    expect(isDefaultGeneratedSessionName('Places in Paris')).toBe(false);
  });
});
