/**
 * @jest-environment jsdom
 *
 * How `ChatActiveStatus` presents each kind of wait: an approval stops the
 * run, so it is named rather than animated.
 */
import {TransformStream} from 'node:stream/web';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import type {ChatActiveStatusInfo} from '../src/components/ChatRenderingTypes';

// The status derivation shares its nested-approval walk with the turn model,
// whose module graph reaches the AI SDK's stream parsing.
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  TransformStream,
});

const {ChatActiveStatus} = await import('../src/components/ChatActiveStatus');

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

  it('keeps the actionable state for assistive technology', () => {
    // The visible copy is aria-hidden, so the announced text is the full one.
    expect(
      renderStatus({
        key: 'approval:1',
        label: 'Waiting for approval…',
        kind: 'approval',
      }),
    ).toContain('Waiting for approval…');
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
