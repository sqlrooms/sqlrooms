/**
 * Mount/unmount plumbing and DOM interaction helpers shared by the composer
 * and suggestions suites.
 */
import {act, type ReactElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';

export type {Root};

/** Mounts `node` into a fresh container attached to the document. */
export async function renderTree(node: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return {container, root};
}

/** Re-renders an already-mounted root, e.g. after swapping the runtime. */
export async function rerenderTree(root: Root, node: ReactElement) {
  await act(async () => {
    root.render(node);
  });
}

export async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

export function textarea(container: HTMLElement) {
  return container.querySelector('textarea');
}

/**
 * Sets a controlled textarea's value the way a real keystroke does.
 *
 * React's synthetic `onChange` is bound to a native `input` event, so writing
 * `.value` directly would not notify the component — the native value setter
 * plus a dispatched `input` event would.
 */
export function typeInto(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', {bubbles: true}));
}

/**
 * Dispatches a `keydown`, defaulting to a bare Enter.
 *
 * `keyCode` is defined as an own getter when requested, since it is the legacy
 * IME-composition signal and is otherwise read-only on a constructed event.
 */
export function fireKeyDown(
  el: Element,
  init: Partial<KeyboardEventInit> & {keyCode?: number} = {},
) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  if (init.keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', {get: () => init.keyCode});
  }
  el.dispatchEvent(event);
}

/** Flushes the auto-resize hook's per-frame `requestAnimationFrame` batching. */
export async function flushAutoResizeFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}
