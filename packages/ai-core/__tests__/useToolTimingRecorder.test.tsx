/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import {RoomStateProvider} from '@sqlrooms/room-store';
import {TransformStream} from 'node:stream/web';
import React from 'react';
import {act} from 'react-dom/test-utils';
import {createRoot} from 'react-dom/client';
import {createStore} from 'zustand';
import type {AiSliceState} from '../src/AiSlice';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {useToolTimingRecorder} =
  await import('../src/hooks/useToolTimingRecorder');

describe('useToolTimingRecorder', () => {
  it('records completion when a completed renderer replaces a pending one', () => {
    const setToolTiming = jest.fn();
    const store = createStore<AiSliceState>(() => ({
      ai: {
        toolTimings: {'tool-1': {startedAt: 100}},
        setToolTiming,
      } as unknown as AiSliceState['ai'],
    }));
    const container = document.createElement('div');
    const root = createRoot(container);

    const Harness = () => {
      useToolTimingRecorder('tool-1', true);
      return null;
    };

    act(() => {
      root.render(
        <RoomStateProvider roomStore={store}>
          <Harness />
        </RoomStateProvider>,
      );
    });

    expect(setToolTiming).toHaveBeenCalledWith('tool-1', {
      startedAt: 100,
      completedAt: expect.any(Number),
    });

    act(() => root.unmount());
  });
});
