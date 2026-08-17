/**
 * @jest-environment jsdom
 */
import React, {act} from 'react';
import {jest} from '@jest/globals';
import {createRoot} from 'react-dom/client';
import {TransformStream} from 'node:stream/web';
import {
  createBaseRoomSlice,
  RoomStateProvider,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createStore} from 'zustand';
import type {AiSliceState} from '../src/AiSlice';

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  TransformStream,
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn(),
});

const {createAiSlice} = await import('../src/AiSlice');
const {PromptSuggestions} = await import('../src/components/PromptSuggestions');
const {TooltipProvider} = await import('@sqlrooms/ui');

type TestState = BaseRoomStoreState & AiSliceState;

describe('PromptSuggestions', () => {
  it('fills the shared draft prompt before a session exists', async () => {
    const store = createStore<TestState>()((set, get, storeApi) => ({
      ...createBaseRoomSlice()(set, get, storeApi),
      ...createAiSlice({
        tools: {} as any,
        getInstructions: () => 'test instructions',
        config: {sessions: []},
      })(set, get, storeApi),
    }));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <TooltipProvider>
            <PromptSuggestions.Item text="Show revenue by month" />
          </TooltipProvider>
        </RoomStateProvider>,
      );
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          'button[title="Show revenue by month"]',
        )
        ?.click();
    });

    expect(store.getState().ai.getCurrentSession()).toBeUndefined();
    expect(store.getState().ai.draftPrompt).toBe('Show revenue by month');

    await act(async () => root.unmount());
    container.remove();
  });
});
