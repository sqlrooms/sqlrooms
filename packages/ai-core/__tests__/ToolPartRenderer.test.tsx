/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import {RoomStateProvider} from '@sqlrooms/room-store';
import type {UIMessagePart} from '@sqlrooms/ai-config';
import {TransformStream} from 'node:stream/web';
import React from 'react';
import {act} from 'react-dom/test-utils';
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

  describe('an agent whose own output is hoisted', () => {
    const Card = ({state}: ToolRendererProps) => (
      <div data-testid="agent-card" data-state={state} />
    );
    // Renderer-only registration: the client has no `execute` for the tool.
    const store = createStore<AiSliceState>(() => ({
      ai: {
        tools: {},
        toolRenderers: {'agent-build': Card},
        agentProgress: {},
        toolTimings: {},
        setToolTiming: jest.fn(),
      } as unknown as AiSliceState['ai'],
    }));

    /** Whether the row draws the tool's own component. */
    function drawsOwnComponent(
      part: UIMessagePart,
      ownOutputHoisted: boolean,
    ): boolean {
      const container = document.createElement('div');
      const root = createRoot(container);
      act(() => {
        root.render(
          <RoomStateProvider roomStore={store}>
            <ToolPartRenderer
              part={part}
              toolCallId="build-1"
              hideAgentSummary
              ownOutputHoisted={ownOutputHoisted}
            />
          </RoomStateProvider>,
        );
      });
      const drawn =
        container.querySelector('[data-testid="agent-card"]') !== null;
      act(() => root.unmount());
      return drawn;
    }

    it('does not draw its result a second time in the activity row', () => {
      const part = {
        type: 'tool-agent-build',
        toolCallId: 'build-1',
        state: 'output-available',
        input: {},
        output: {
          success: true,
          agentToolCalls: [
            {toolCallId: 'query-1', toolName: 'query', state: 'success'},
          ],
        },
      } as UIMessagePart;

      expect(drawsOwnComponent(part, false)).toBe(true);
      expect(drawsOwnComponent(part, true)).toBe(false);
    });

    it('does not draw its approval request a second time either', () => {
      const part = {
        type: 'tool-agent-build',
        toolCallId: 'build-1',
        state: 'approval-requested',
        input: {},
        approval: {id: 'approval-1'},
      } as UIMessagePart;

      expect(drawsOwnComponent(part, false)).toBe(true);
      expect(drawsOwnComponent(part, true)).toBe(false);
    });
  });
});
