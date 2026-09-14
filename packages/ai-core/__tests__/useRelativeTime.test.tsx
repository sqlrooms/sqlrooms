/**
 * @jest-environment jsdom
 *
 * The "x ago" label: how it tracks the clock, and why it can never describe a
 * timestamp as being in the future.
 */
import {jest} from '@jest/globals';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {useRelativeTime} from '../src/hooks/useRelativeTime';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

const START = new Date('2026-01-01T12:00:00Z').getTime();
const MINUTE = 60_000;

function Probe({timestamp}: {timestamp?: number}) {
  return <span>{useRelativeTime(timestamp) ?? '(none)'}</span>;
}

let container: HTMLDivElement;
let root: Root;

function render(timestamp?: number) {
  act(() => root.render(<Probe timestamp={timestamp} />));
  return container.textContent;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

describe('useRelativeTime', () => {
  it('has no label without a timestamp', () => {
    expect(render(undefined)).toBe('(none)');
  });

  it('describes how long ago the timestamp was', () => {
    expect(render(START - 5 * MINUTE)).toBe('5 minutes ago');
  });

  it('re-reads the clock on each interval tick', () => {
    render(START - 5 * MINUTE);
    act(() => {
      jest.advanceTimersByTime(10 * MINUTE);
    });
    expect(container.textContent).toBe('15 minutes ago');
  });

  it('holds the label steady between ticks', () => {
    render(START - 5 * MINUTE);
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(container.textContent).toBe('5 minutes ago');
  });

  it('never renders a timestamp newer than its last clock read as future', () => {
    render(START - MINUTE);
    // Time moves on without the interval firing, then a fresh timestamp
    // arrives. Measured against the stale clock it would read "in 8 hours".
    jest.setSystemTime(START + 8 * 60 * MINUTE);
    expect(render(Date.now())).toBe('a few seconds ago');
  });
});
