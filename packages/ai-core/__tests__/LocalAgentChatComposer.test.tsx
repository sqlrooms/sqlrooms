/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

const sendPrompt = jest.fn();
const onRun = jest.fn<() => false>(() => false);

jest.unstable_mockModule('../src/components/ChatRuntimeContext', () => ({
  useChatRuntime: () => ({
    mode: 'local-agent',
    messages: [],
    status: 'ready',
    isStreaming: false,
    prompt: 'Do not send this',
    setPrompt: jest.fn(),
    sendPrompt,
    stop: jest.fn(),
    initialSuggestions: [],
    suggestionsVisible: true,
    setSuggestionsVisible: jest.fn(),
  }),
}));

const {LocalAgentChatComposer} =
  await import('../src/components/LocalAgentChatComposer');

describe('LocalAgentChatComposer', () => {
  beforeEach(() => {
    sendPrompt.mockClear();
    onRun.mockClear();
  });

  it('does not send when onRun cancels the prompt', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LocalAgentChatComposer onRun={onRun} />);
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
    });

    expect(onRun).toHaveBeenCalledWith('Do not send this');
    expect(sendPrompt).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });
});
