/**
 * @jest-environment jsdom
 *
 * How `ChatActiveStatus` presents each kind of wait: an approval stops the
 * run, so it is named rather than animated.
 */
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {ChatActiveStatus} from '../src/components/ChatActiveStatus';
import type {ChatActiveStatusInfo} from '../src/components/ChatRenderingTypes';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

function renderStatus(status: ChatActiveStatusInfo): string {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ChatActiveStatus status={status} />);
  });
  const text = container.textContent ?? '';
  act(() => root.unmount());
  container.remove();
  return text;
}

describe('ChatActiveStatus', () => {
  it('names an approval wait instead of animating it', () => {
    expect(
      renderStatus({
        key: 'approval:1',
        label: 'Waiting for approval…',
        kind: 'approval',
      }),
    ).toContain('Paused…');
  });

  it('leaves work in flight to the animated dots', () => {
    const text = renderStatus({
      key: 'model:waiting',
      label: 'Waiting for model…',
      kind: 'model',
    });
    expect(text).not.toContain('Paused…');
    // Only the screen-reader label names the wait.
    expect(text).toContain('Waiting for model…');
  });
});
