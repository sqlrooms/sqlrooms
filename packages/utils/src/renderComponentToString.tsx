import type React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';

export function renderComponentToString<P extends object>(
  Component: React.ComponentType<P>,
  props: P,
): string {
  const container = document.createElement('div');

  const root = createRoot(container);

  flushSync(() => {
    root.render(<Component {...props} />);
  });

  const html = container.innerHTML;

  // Clean up the root to prevent memory leaks
  root.unmount();

  return html;
}
