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
  it.each([
    [
      'direct text',
      (wide: boolean) => (wide ? 'long text'.repeat(20) : 'short'),
    ],
    ['direct number', (wide: boolean) => (wide ? 123456789012345 : 1)],
    [
      'nested text in a fixed-size child',
      (wide: boolean) => (
        <span style={{width: 100}}>
          <span>{wide ? 'long text'.repeat(20) : 'short'}</span>
        </span>
      ),
    ],
    [
      'nested child additions and removals',
      (wide: boolean) => (
        <span style={{width: 100}}>
          <span>short</span>
          {wide && <span>{'extra content'.repeat(20)}</span>}
        </span>
      ),
    ],
    [
      'direct child additions and removals',
      (wide: boolean) => [
        <span key="first">short</span>,
        ...(wide
          ? [<span key="extra">{'extra content'.repeat(20)}</span>]
          : []),
      ],
    ],
  ])('refreshes arrows after %s changes', async (_name, content) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const render = async (wide: boolean) => {
      await act(async () => {
        root.render(<ScrollableRow>{content(wide)}</ScrollableRow>);
      });
    };

    try {
      await render(false);
      const wrapper = host.firstElementChild!;
      const scrollContainer = wrapper.children[1]!;
      // jsdom has no layout: model content overflow while keeping the viewport
      // fixed. ResizeObserver is inert, so only real DOM mutations can refresh it.
      Object.defineProperties(scrollContainer, {
        clientWidth: {get: () => 100},
        scrollWidth: {
          get: () =>
            Math.max(100, (scrollContainer.textContent?.length ?? 0) * 10),
        },
      });
      const left = wrapper.querySelector<HTMLButtonElement>(
        '[aria-label="Scroll left"]',
      )!;
      const right = wrapper.querySelector<HTMLButtonElement>(
        '[aria-label="Scroll right"]',
      )!;
      expect(right.disabled).toBe(true);

      await render(true);
      expect(wrapper.children[1]).toBe(scrollContainer);
      expect(right.disabled).toBe(false);
      expect(left.disabled).toBe(true);

      await render(false);
      expect(wrapper.children[1]).toBe(scrollContainer);
      expect(right.disabled).toBe(true);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

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
