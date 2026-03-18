import type React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

/**
 * Internal helper: Renders a React component and returns both container and root
 */
function renderToContainer<P extends object>(
  Component: React.ComponentType<P>,
  props: P,
): {container: HTMLDivElement; root: ReturnType<typeof createRoot>} {
  const container = document.createElement('div');
  const root = createRoot(container);

  flushSync(() => {
    root.render(<Component {...props} />);
  });

  return {container, root};
}

/**
 * Renders a React component to a DOM element with cleanup support
 * Returns an object with the rendered DOM node and a destroy callback.
 * The destroy callback must be called to unmount the React root and prevent memory leaks.
 */
export function renderComponentToDomElement<P extends object>(
  Component: React.ComponentType<P>,
  props: P,
): {dom: HTMLDivElement; destroy: () => void} {
  const {container, root} = renderToContainer(Component, props);
  return {
    dom: container,
    destroy: () => root.unmount(),
  };
}

/**
 * Renders a React component to an HTML string
 * The root is properly unmounted to prevent memory leaks.
 */
export function renderComponentToString<P extends object>(
  Component: React.ComponentType<P>,
  props: P,
): string {
  const {container, root} = renderToContainer(Component, props);
  const html = container.innerHTML;

  // Clean up the root to prevent memory leaks
  root.unmount();

  return html;
}
