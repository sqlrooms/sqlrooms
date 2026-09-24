/**
 * @jest-environment jsdom
 */
import {describe, expect, jest, test} from '@jest/globals';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {EditableText} from '../src/components/editable-text';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

function render(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    input: container.querySelector('input')!,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function startEditing(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new MouseEvent('click', {bubbles: true}));
  });
}

function type(input: HTMLInputElement, text: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

/** React maps `onBlur` onto the bubbling `focusout` event. */
function blur(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
  });
}

function pressEnter() {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
  });
}

describe('EditableText', () => {
  test('commits an edit on blur', () => {
    const onChange = jest.fn();
    const {input, unmount} = render(
      <EditableText value="Before" onChange={onChange} />,
    );
    try {
      startEditing(input);
      type(input, '  After  ');
      blur(input);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('After');
    } finally {
      unmount();
    }
  });

  test('commits an edit on Enter', () => {
    const onChange = jest.fn();
    const {input, unmount} = render(
      <EditableText value="Before" onChange={onChange} />,
    );
    try {
      startEditing(input);
      type(input, 'After');
      pressEnter();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('After');
    } finally {
      unmount();
    }
  });

  test('does not commit when focusing and leaving without an edit', () => {
    const onChange = jest.fn();
    const {input, unmount} = render(
      <EditableText value="Before" onChange={onChange} />,
    );
    try {
      startEditing(input);
      blur(input);
      startEditing(input);
      pressEnter();
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });

  test('does not commit an edit that trims back to the current value', () => {
    const onChange = jest.fn();
    const {input, unmount} = render(
      <EditableText value="Before" onChange={onChange} />,
    );
    try {
      startEditing(input);
      type(input, 'Before ');
      blur(input);
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });

  test('normalises a padded value on commit', () => {
    const onChange = jest.fn();
    const {input, unmount} = render(
      <EditableText value="  Padded  " onChange={onChange} />,
    );
    try {
      blur(input);
      expect(onChange).toHaveBeenCalledWith('Padded');
    } finally {
      unmount();
    }
  });
});
