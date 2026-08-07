/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn(),
});

const setPrompt = jest.fn();

jest.unstable_mockModule('../src/components/ChatRuntimeContext', () => ({
  useChatRuntime: () => ({
    mode: 'local-agent',
    messages: [],
    status: 'ready',
    isStreaming: false,
    prompt: '',
    setPrompt,
    sendPrompt: jest.fn(),
    stop: jest.fn(),
    initialSuggestions: [],
    suggestionsVisible: true,
    setSuggestionsVisible: jest.fn(),
  }),
}));

const {LocalAgentPromptSuggestionItem} =
  await import('../src/components/LocalAgentPromptSuggestions');
const {TooltipProvider} = await import('@sqlrooms/ui');

describe('LocalAgentPromptSuggestionItem', () => {
  beforeEach(() => {
    setPrompt.mockClear();
  });

  it('calls the custom click handler instead of setting the prompt', async () => {
    const onClick = jest.fn<(text: string) => void>();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TooltipProvider>
          <LocalAgentPromptSuggestionItem
            text="Inspect revenue"
            onClick={onClick}
          />
        </TooltipProvider>,
      );
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[title="Inspect revenue"]')
        ?.click();
    });

    expect(onClick).toHaveBeenCalledWith('Inspect revenue');
    expect(setPrompt).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });
});
