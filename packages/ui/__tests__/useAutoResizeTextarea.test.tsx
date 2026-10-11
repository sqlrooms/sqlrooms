/**
 * @jest-environment jsdom
 */
import {jest} from '@jest/globals';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {useAutoResizeTextarea} from '../src/hooks/useAutoResizeTextarea';

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

/**
 * jsdom does not run layout, so `scrollHeight` is always 0 and
 * `getComputedStyle` never reflects a stylesheet's `max-height`. Both are
 * stubbed per element so the hook's height-writing and overflow-detection
 * logic can be exercised against values under test control, the same
 * approach `useAspectRatioDimensions.test.tsx` uses for `ResizeObserver`.
 */
function stubLayout(el: HTMLElement, scrollHeight: number, maxHeight: string) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  const original = window.getComputedStyle(el);
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((target: Element) => {
      if (target === el) {
        return {...original, maxHeight} as CSSStyleDeclaration;
      }
      return original;
    });
}

/** Probes the hook's live return value while rendering a plain textarea. */
function HookProbe({
  textareaRef,
  value,
  onResult,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onResult: (result: {hasOverflow: boolean}) => void;
}) {
  const {hasOverflow} = useAutoResizeTextarea({
    autoResize: true,
    textareaRef,
    value,
    defaultValue: undefined,
  });
  onResult({hasOverflow});
  return <textarea ref={textareaRef} value={value} readOnly />;
}

describe('useAutoResizeTextarea', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes the element height to fit its content', async () => {
    const textareaRef: React.RefObject<HTMLTextAreaElement | null> = {
      current: null,
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let latest: {hasOverflow: boolean} | undefined;

    await act(async () => {
      root.render(
        <HookProbe
          textareaRef={textareaRef}
          value="short"
          onResult={(r) => (latest = r)}
        />,
      );
    });

    const el = textareaRef.current;
    if (!el) throw new Error('textarea did not mount');
    stubLayout(el, 40, 'none');

    // Drive a value change, which re-triggers the resize path measured
    // against the stubbed scrollHeight.
    await act(async () => {
      root.render(
        <HookProbe
          textareaRef={textareaRef}
          value="short\nmore"
          onResult={(r) => (latest = r)}
        />,
      );
    });
    // Resize is scheduled via requestAnimationFrame; flush it.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(el.style.height).toBe('40px');
    expect(latest?.hasOverflow).toBe(false);

    await act(async () => root.unmount());
    container.remove();
  });

  it('reports overflow once content exceeds max-height', async () => {
    const textareaRef: React.RefObject<HTMLTextAreaElement | null> = {
      current: null,
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let latest: {hasOverflow: boolean} | undefined;

    await act(async () => {
      root.render(
        <HookProbe
          textareaRef={textareaRef}
          value="line one"
          onResult={(r) => (latest = r)}
        />,
      );
    });

    const el = textareaRef.current;
    if (!el) throw new Error('textarea did not mount');
    stubLayout(el, 200, '120px');

    await act(async () => {
      root.render(
        <HookProbe
          textareaRef={textareaRef}
          value="line one\nline two\nline three\nline four"
          onResult={(r) => (latest = r)}
        />,
      );
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(el.style.height).toBe('200px');
    expect(latest?.hasOverflow).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  it('applies to a textarea element the test rendered itself, not via Textarea', async () => {
    // This is the property Phase 3 depends on: the hook must operate on any
    // textarea reached via a ref, including one that this package's
    // `Textarea` component never rendered — standing in for a host
    // supplying its own textarea component.
    const textareaRef: React.RefObject<HTMLTextAreaElement | null> = {
      current: null,
    };
    const resizeRef: {current: (() => void) | null} = {current: null};

    function ForeignTextarea() {
      const {resizeToFitContent} = useAutoResizeTextarea({
        autoResize: true,
        textareaRef,
        value: 'hi',
        defaultValue: undefined,
      });
      // Assigned in an effect rather than during render: writing to a value
      // defined outside the component during render is disallowed by
      // `react-hooks/immutability`.
      React.useEffect(() => {
        resizeRef.current = resizeToFitContent;
      }, [resizeToFitContent]);
      // A plain textarea, unrelated to `@sqlrooms/ui`'s `Textarea`.
      return <textarea ref={textareaRef} value="hi" readOnly />;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ForeignTextarea />);
    });

    const el = textareaRef.current;
    if (!el) throw new Error('textarea did not mount');
    stubLayout(el, 55, 'none');

    // Re-invoke the resize path exposed by the hook, the same call a host's
    // own input handler would make.
    await act(async () => {
      resizeRef.current?.();
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(el.style.height).toBe('55px');

    await act(async () => root.unmount());
    container.remove();
  });
});
