/**
 * @jest-environment jsdom
 */
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {ScrollableRow} from '../src/components/scrollable-row';

// jsdom does not implement ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, {
  ResizeObserver: ResizeObserverStub,
  IS_REACT_ACT_ENVIRONMENT: true,
});

describe('ScrollableRow', () => {
  it('forwards its ref to a real DOM node and passes through a data- prop', async () => {
    const ref: React.RefObject<HTMLDivElement | null> = {current: null};
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ScrollableRow ref={ref} data-testid="row">
          <span>item</span>
        </ScrollableRow>,
      );
    });

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.getAttribute('data-testid')).toBe('row');
    // The outermost element receiving the ref is the same one carrying the
    // pass-through prop, proving `asChild`-style wrapping keeps both.
    expect(container.querySelector('[data-testid="row"]')).toBe(ref.current);

    await act(async () => root.unmount());
    container.remove();
  });
});
