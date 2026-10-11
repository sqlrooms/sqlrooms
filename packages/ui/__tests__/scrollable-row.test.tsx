/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {ScrollableRow} from '../src/components/scrollable-row';

// jsdom does not implement ResizeObserver.
class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  readonly targets = new Set<Element>();

  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
}

Object.assign(globalThis, {
  ResizeObserver: ResizeObserverStub,
  IS_REACT_ACT_ENVIRONMENT: true,
});

describe('ScrollableRow', () => {
  beforeEach(() => {
    ResizeObserverStub.instances = [];
  });

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
    [
      'className on a fixed-size child',
      (wide: boolean) => (
        <div style={{width: 100, height: 20}} className={wide ? 'nowrap' : ''}>
          The text stays unchanged
        </div>
      ),
    ],
    [
      'style on a fixed-size child',
      (wide: boolean) => (
        <div
          style={{
            width: 100,
            height: 20,
            whiteSpace: wide ? 'nowrap' : 'normal',
          }}
        >
          The text stays unchanged
        </div>
      ),
    ],
    [
      'nested className',
      (wide: boolean) => (
        <div style={{width: 100, height: 20}}>
          <span className={wide ? 'nowrap' : ''}>The text stays unchanged</span>
        </div>
      ),
    ],
    [
      'nested hidden attribute',
      (wide: boolean) => (
        <div style={{width: 100, height: 20, whiteSpace: 'nowrap'}}>
          <span hidden={!wide}>The text stays unchanged</span>
        </div>
      ),
    ],
    [
      'nested data attribute used by a CSS selector',
      (wide: boolean) => (
        <div style={{width: 100, height: 20}}>
          <span data-wrap={wide ? 'nowrap' : 'normal'}>
            The text stays unchanged
          </span>
        </div>
      ),
    ],
    [
      'nested style',
      (wide: boolean) => (
        <div style={{width: 100, height: 20}}>
          <span style={{whiteSpace: wide ? 'nowrap' : 'normal'}}>
            The text stays unchanged
          </span>
        </div>
      ),
    ],
  ])('refreshes arrows after %s changes', async (_name, content) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let scrollWidth = 100;
    const render = async (wide: boolean) => {
      scrollWidth = wide ? 600 : 100;
      await act(async () => {
        root.render(<ScrollableRow>{content(wide)}</ScrollableRow>);
      });
    };

    try {
      await render(false);
      const wrapper = host.firstElementChild!;
      const scrollContainer = wrapper.children[1]!;
      // jsdom has no layout: model content overflow while keeping the viewport
      // fixed. No resize callbacks fire, so only DOM mutations can refresh it.
      Object.defineProperties(scrollContainer, {
        clientWidth: {get: () => 100},
        scrollWidth: {get: () => scrollWidth},
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

  it('refreshes arrows when a direct child resizes without a DOM mutation', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      await act(async () => {
        root.render(
          <ScrollableRow>
            <span>Content with a changing intrinsic size</span>
          </ScrollableRow>,
        );
      });
      const wrapper = host.firstElementChild!;
      const scrollContainer = wrapper.children[1]!;
      const child = scrollContainer.firstElementChild!;
      let childWidth = 100;
      Object.defineProperties(scrollContainer, {
        clientWidth: {get: () => 100},
        scrollWidth: {get: () => child.clientWidth},
      });
      Object.defineProperty(child, 'clientWidth', {get: () => childWidth});
      const right = wrapper.querySelector<HTMLButtonElement>(
        '[aria-label="Scroll right"]',
      )!;
      const observer = ResizeObserverStub.instances.find((instance) =>
        instance.targets.has(child),
      );
      expect(observer).toBeDefined();
      expect(right.disabled).toBe(true);

      for (const width of [600, 100]) {
        await act(async () => {
          childWidth = width;
          observer!.callback([], observer!);
        });
        expect(right.disabled).toBe(width === 100);
      }
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
    expect(
      ResizeObserverStub.instances.every(({targets}) => targets.size === 0),
    ).toBe(true);
  });

  it.each(['loadingdone', 'loadingerror'])(
    'refreshes direct-text overflow after fonts emit %s and cleans up listeners',
    async (eventType) => {
      // jsdom has no FontFaceSet. Use real events with mocked layout metrics.
      const fonts = new EventTarget();
      const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: fonts,
      });
      const addListener = jest.spyOn(fonts, 'addEventListener');
      const removeListener = jest.spyOn(fonts, 'removeEventListener');
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);
      try {
        await act(async () => {
          root.render(
            <ScrollableRow>Direct text in a late-loading font</ScrollableRow>,
          );
        });
        const wrapper = host.firstElementChild!;
        const scrollContainer = wrapper.children[1]!;
        let scrollWidth = 100;
        Object.defineProperties(scrollContainer, {
          clientWidth: {get: () => 100},
          scrollWidth: {get: () => scrollWidth},
        });
        const right = wrapper.querySelector<HTMLButtonElement>(
          '[aria-label="Scroll right"]',
        )!;
        expect(scrollContainer.children.length).toBe(0);
        expect(right.disabled).toBe(true);

        for (const width of [600, 100]) {
          await act(async () => {
            scrollWidth = width;
            fonts.dispatchEvent(new Event(eventType));
          });
          expect(right.disabled).toBe(width === 100);
        }
      } finally {
        await act(async () => root.unmount());
        host.remove();
        if (originalFonts) {
          Object.defineProperty(document, 'fonts', originalFonts);
        } else {
          Reflect.deleteProperty(document, 'fonts');
        }
      }
      expect(addListener).toHaveBeenCalled();
      for (const [type, listener] of addListener.mock.calls) {
        expect(removeListener).toHaveBeenCalledWith(type, listener);
      }
    },
  );

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
