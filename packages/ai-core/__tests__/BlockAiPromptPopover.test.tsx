/**
 * @jest-environment jsdom
 */
import React, {useState} from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const {BlockAiPromptPopover} =
  await import('../src/components/BlockAiPromptPopover');

function setInputValue(element: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  valueSetter?.call(element, value);
  element.dispatchEvent(new Event('input', {bubbles: true}));
}

function TestPopover() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(false)}>
        Close
      </button>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <BlockAiPromptPopover
        open={open}
        onOpenChange={setOpen}
        label="Ask AI"
        placeholder="Ask AI to edit this block..."
        trigger={<button type="button">Ask</button>}
        onSubmit={() => {}}
      />
    </>
  );
}

function renderPopover() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<TestPopover />);
  });

  return {container, root};
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
}

describe('BlockAiPromptPopover', () => {
  it('preserves draft text after closing and reopening', () => {
    const {container, root} = renderPopover();

    try {
      const textarea = document.querySelector('textarea');
      if (!textarea) throw new Error('Expected prompt textarea to render.');

      act(() => {
        setInputValue(textarea, 'enable map color scale');
      });

      act(() => {
        container
          .querySelector<HTMLButtonElement>('button[type="button"]')
          ?.click();
      });

      expect(document.querySelector('textarea')).toBeNull();

      act(() => {
        const openButton = Array.from(
          container.querySelectorAll<HTMLButtonElement>('button'),
        ).find((button) => button.textContent === 'Open');
        openButton?.click();
      });

      expect(
        document.querySelector<HTMLTextAreaElement>('textarea')?.value,
      ).toBe('enable map color scale');
    } finally {
      cleanup(container, root);
    }
  });
});
