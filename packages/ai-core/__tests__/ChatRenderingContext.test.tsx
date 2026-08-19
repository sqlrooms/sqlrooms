/**
 * @jest-environment jsdom
 */
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {TransformStream} from 'node:stream/web';
import type {ChatActiveStatusProps} from '../src/components/ChatRenderingContext';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {ChatRendering, useChatRenderingComponents} =
  await import('../src/components/ChatRenderingContext');

const ActiveStatusConsumer = () => {
  const ActiveStatus = useChatRenderingComponents().ActiveStatus;
  return (
    <ActiveStatus
      status={{key: 'tool:query-1', label: 'Running query…', kind: 'tool'}}
    />
  );
};

describe('ChatRendering', () => {
  it('resolves defaults without importing Chat or ChatTurnView first', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <ChatRendering>
          <span>ready</span>
        </ChatRendering>,
      );
    });

    expect(container.textContent).toBe('ready');

    act(() => root.unmount());
  });

  it('allows the active run status presentation to be replaced', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const CustomActiveStatus = ({status}: ChatActiveStatusProps) => (
      <span data-testid="custom-active-status">Custom: {status.label}</span>
    );

    act(() => {
      root.render(
        <ChatRendering components={{ActiveStatus: CustomActiveStatus}}>
          <ActiveStatusConsumer />
        </ChatRendering>,
      );
    });

    expect(
      container.querySelector('[data-testid="custom-active-status"]')
        ?.textContent,
    ).toBe('Custom: Running query…');

    act(() => root.unmount());
  });
});
