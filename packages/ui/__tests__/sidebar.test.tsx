/**
 * @jest-environment jsdom
 */
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {
  Sidebar,
  SidebarProvider,
  type SidebarProviderProps,
  SidebarRail,
} from '../src/components/sidebar';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

beforeAll(() => {
  // jsdom has no matchMedia; useIsMobile only needs the listener methods.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function render(
  props: Partial<SidebarProviderProps> = {},
  side: 'left' | 'right' = 'left',
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const renderWith = (nextProps: Partial<SidebarProviderProps>) =>
    act(() =>
      root.render(
        <SidebarProvider {...nextProps}>
          <Sidebar side={side}>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>,
      ),
    );
  renderWith(props);
  cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  const query = (slot: string) =>
    container.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
  return {
    rerender: renderWith,
    rail: () => query('sidebar-rail'),
    width: () =>
      query('sidebar-wrapper').style.getPropertyValue('--sidebar-width'),
    state: () => query('sidebar').getAttribute('data-state'),
    resizing: () => query('sidebar-wrapper').hasAttribute('data-resizing'),
  };
}

function pointer(target: HTMLElement, type: string, clientX: number) {
  // jsdom lacks PointerEvent; React only reads these fields.
  const event = new MouseEvent(type, {bubbles: true, clientX, button: 0});
  Object.defineProperty(event, 'pointerId', {value: 1});
  act(() => {
    target.dispatchEvent(event);
  });
}

function drag(target: HTMLElement, xs: number[]) {
  pointer(target, 'pointerdown', xs[0]!);
  for (const x of xs.slice(1)) pointer(target, 'pointermove', x);
  pointer(target, 'pointerup', xs[xs.length - 1]!);
  act(() => {
    target.dispatchEvent(new MouseEvent('click', {bubbles: true}));
  });
}

function key(target: HTMLElement, keyName: string) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', {key: keyName, bubbles: true}),
    );
  });
}

describe('SidebarRail without defaultWidth', () => {
  test('stays a toggle button', () => {
    const view = render();
    expect(view.rail().tagName).toBe('BUTTON');
    expect(view.width()).toBe('16rem');
    act(() => view.rail().click());
    expect(view.state()).toBe('collapsed');
  });
});

describe('SidebarRail with defaultWidth', () => {
  test('is a separator showing the width', () => {
    const view = render({defaultWidth: 300});
    expect(view.rail().getAttribute('role')).toBe('separator');
    expect(view.rail().getAttribute('aria-valuenow')).toBe('300');
    expect(view.width()).toBe('300px');
  });

  test('dragging resizes and reports the width once, at the end', () => {
    const onWidthChange = jest.fn();
    const view = render({defaultWidth: 300, onWidthChange});
    pointer(view.rail(), 'pointerdown', 300);
    pointer(view.rail(), 'pointermove', 340);
    expect(view.resizing()).toBe(true);
    pointer(view.rail(), 'pointermove', 380);
    expect(view.width()).toBe('380px');
    expect(onWidthChange).not.toHaveBeenCalled();
    pointer(view.rail(), 'pointerup', 380);
    expect(view.resizing()).toBe(false);
    expect(onWidthChange).toHaveBeenCalledTimes(1);
    expect(onWidthChange).toHaveBeenCalledWith(380);
  });

  test('a drag does not also toggle; a plain click does', () => {
    const view = render({defaultWidth: 300});
    drag(view.rail(), [300, 350]);
    expect(view.state()).toBe('expanded');
    drag(view.rail(), [300, 301]);
    expect(view.state()).toBe('collapsed');
  });

  test('clamps to minWidth and maxWidth', () => {
    const view = render({defaultWidth: 300, minWidth: 250, maxWidth: 400});
    drag(view.rail(), [300, 900]);
    expect(view.width()).toBe('400px');
    drag(view.rail(), [400, 230]);
    expect(view.width()).toBe('250px');
    expect(view.state()).toBe('expanded');
  });

  test('dragging past the minimum collapses, dragging back reopens', () => {
    const view = render({defaultWidth: 300, minWidth: 250});
    pointer(view.rail(), 'pointerdown', 300);
    pointer(view.rail(), 'pointermove', 200);
    expect(view.state()).toBe('collapsed');
    pointer(view.rail(), 'pointermove', 230);
    expect(view.state()).toBe('expanded');
    pointer(view.rail(), 'pointermove', 280);
    expect(view.width()).toBe('300px');
    pointer(view.rail(), 'pointerup', 280);
  });

  test('dragging a collapsed sidebar outward reopens it', () => {
    const view = render({defaultWidth: 300, defaultOpen: false});
    expect(view.state()).toBe('collapsed');
    drag(view.rail(), [0, 10, 60]);
    expect(view.state()).toBe('expanded');
    expect(view.width()).toBe('350px');
  });

  test('a right-side sidebar widens when dragged left', () => {
    const view = render({defaultWidth: 300}, 'right');
    drag(view.rail(), [500, 450]);
    expect(view.width()).toBe('350px');
    key(view.rail(), 'ArrowRight');
    expect(view.width()).toBe('334px');
  });

  test('arrow keys resize, Enter toggles', () => {
    const onWidthChange = jest.fn();
    const view = render({defaultWidth: 300, onWidthChange});
    key(view.rail(), 'ArrowRight');
    expect(view.width()).toBe('316px');
    expect(onWidthChange).toHaveBeenLastCalledWith(316);
    key(view.rail(), 'ArrowLeft');
    expect(view.width()).toBe('300px');
    key(view.rail(), 'Enter');
    expect(view.state()).toBe('collapsed');
  });

  test('a smaller maxWidth clamps the shown width but keeps the chosen one', () => {
    const view = render({defaultWidth: 500, maxWidth: 640});
    view.rerender({defaultWidth: 500, maxWidth: 400});
    expect(view.width()).toBe('400px');
    view.rerender({defaultWidth: 500, maxWidth: 640});
    expect(view.width()).toBe('500px');
  });
});
