/**
 * @jest-environment jsdom
 */
import {beforeAll, describe, expect, jest, test} from '@jest/globals';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {SliderInput} from '../src/components/slider-input';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

beforeAll(() => {
  // Radix's slider measures its thumb via ResizeObserver, which jsdom lacks.
  Object.assign(globalThis, {
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});

function render(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    toggle: () => container.querySelector('button')!,
    input: () => container.querySelector('input[type="number"]'),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', {bubbles: true}));
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

function pressKey(input: HTMLInputElement, key: string) {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
  });
}

/** React maps `onBlur` onto the bubbling `focusout` event. */
function blur(input: HTMLInputElement) {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', {bubbles: true}));
  });
}

describe('SliderInput', () => {
  test('shows the slider until the toggle is clicked', () => {
    const view = render(
      <SliderInput
        min={0}
        max={100}
        step={1}
        value={42}
        onValueChange={noop}
      />,
    );
    try {
      expect(view.input()).toBeNull();
      click(view.toggle());
      expect(view.input()?.value).toBe('42');
    } finally {
      view.unmount();
    }
  });

  test('commits a typed value on Enter and returns to the slider', () => {
    const onValueChange = jest.fn();
    const view = render(
      <SliderInput
        min={0.01}
        max={1000}
        step={0.01}
        value={1}
        onValueChange={onValueChange}
      />,
    );
    try {
      click(view.toggle());
      type(view.input()!, '237.5');
      pressKey(view.input()!, 'Enter');
      expect(onValueChange).toHaveBeenCalledWith(237.5);
      expect(view.input()).toBeNull();
    } finally {
      view.unmount();
    }
  });

  test('commits on blur', () => {
    const onValueChange = jest.fn();
    const view = render(
      <SliderInput
        min={0}
        max={100}
        step={1}
        value={10}
        onValueChange={onValueChange}
      />,
    );
    try {
      click(view.toggle());
      type(view.input()!, '55');
      blur(view.input()!);
      expect(onValueChange).toHaveBeenCalledWith(55);
    } finally {
      view.unmount();
    }
  });

  test('discards the edit on Escape', () => {
    const onValueChange = jest.fn();
    const view = render(
      <SliderInput
        min={0}
        max={100}
        step={1}
        value={10}
        onValueChange={onValueChange}
      />,
    );
    try {
      click(view.toggle());
      type(view.input()!, '55');
      pressKey(view.input()!, 'Escape');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(view.input()).toBeNull();
    } finally {
      view.unmount();
    }
  });

  test('clamps and snaps typed values to the slider range and step', () => {
    const onValueChange = jest.fn();
    const view = render(
      <SliderInput
        min={1}
        max={20}
        step={0.5}
        value={5}
        onValueChange={onValueChange}
      />,
    );
    try {
      click(view.toggle());
      type(view.input()!, '7.2');
      pressKey(view.input()!, 'Enter');
      expect(onValueChange).toHaveBeenLastCalledWith(7);

      click(view.toggle());
      type(view.input()!, '999');
      pressKey(view.input()!, 'Enter');
      expect(onValueChange).toHaveBeenLastCalledWith(20);
    } finally {
      view.unmount();
    }
  });

  test('ignores an empty or non-numeric entry', () => {
    const onValueChange = jest.fn();
    const view = render(
      <SliderInput
        min={0}
        max={100}
        step={1}
        value={10}
        onValueChange={onValueChange}
      />,
    );
    try {
      click(view.toggle());
      type(view.input()!, '');
      pressKey(view.input()!, 'Enter');
      expect(onValueChange).not.toHaveBeenCalled();
    } finally {
      view.unmount();
    }
  });
});

function noop() {}
