/**
 * @jest-environment jsdom
 */
import {describe, expect, jest, test} from '@jest/globals';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {BlockCaptionEditor} from '../src/components/BlockCaptionEditor';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

function render(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** React maps `onBlur` onto the bubbling `focusout` event. */
function blur(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
  });
}

function edit(input: HTMLInputElement, text: string) {
  act(() => {
    input.dispatchEvent(new MouseEvent('click', {bubbles: true}));
  });
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

describe('BlockCaptionEditor', () => {
  test('commits an edited caption on blur', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <BlockCaptionEditor value="Before" onChange={onChange} />,
    );
    try {
      const input = container.querySelector('input')!;
      edit(input, 'After');
      blur(input);
      expect(onChange).toHaveBeenCalledWith('After');
    } finally {
      unmount();
    }
  });

  test('swallows a commit that leaves the caption unchanged', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <BlockCaptionEditor value="Before" onChange={onChange} />,
    );
    try {
      const input = container.querySelector('input')!;
      act(() => {
        input.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      });
      blur(input);
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });

  test('still normalises surrounding whitespace', () => {
    const onChange = jest.fn();
    const {container, unmount} = render(
      <BlockCaptionEditor value="  Padded  " onChange={onChange} />,
    );
    try {
      blur(container.querySelector('input')!);
      expect(onChange).toHaveBeenCalledWith('Padded');
    } finally {
      unmount();
    }
  });
});
