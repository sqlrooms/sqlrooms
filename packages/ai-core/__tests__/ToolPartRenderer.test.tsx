/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import {RoomStateProvider} from '@sqlrooms/room-store';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {TransformStream} from 'node:stream/web';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {createStore} from 'zustand';
import type {AiSliceState} from '../src/AiSlice';
import type {ToolRendererProps} from '../src/types';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {ToolPartRenderer} = await import('../src/components/ToolPartRenderer');

describe('ToolPartRenderer', () => {
  it('renders memoized registry components', () => {
    const MemoizedRenderer = React.memo(function MemoizedRenderer({
      output,
    }: ToolRendererProps<{label: string}>) {
      return <div data-testid="memoized-tool">{output?.label}</div>;
    });
    const store = createStore<AiSliceState>(() => ({
      ai: {
        tools: {},
        toolRenderers: {memoized: MemoizedRenderer},
        agentProgress: {},
        toolTimings: {},
        setToolTiming: jest.fn(),
      } as unknown as AiSliceState['ai'],
    }));
    const container = document.createElement('div');
    const root = createRoot(container);
    const part = {
      type: 'tool-memoized',
      toolCallId: 'memoized-1',
      state: 'output-available',
      input: {},
      output: {label: 'memoized output'},
    } as UIMessagePart;

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <ToolPartRenderer part={part} toolCallId="memoized-1" />
        </RoomStateProvider>,
      );
    });

    expect(
      container.querySelector('[data-testid="memoized-tool"]')?.textContent,
    ).toBe('memoized output');

    act(() => root.unmount());
  });
});
