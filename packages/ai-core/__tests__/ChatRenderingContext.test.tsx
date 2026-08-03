/**
 * @jest-environment jsdom
 */
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {TransformStream} from 'node:stream/web';

Object.assign(globalThis, {
  TransformStream,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {ChatRendering} = await import('../src/components/ChatRenderingContext');

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
});
