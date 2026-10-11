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

  it('measures a timestamp that arrives later against a current clock', () => {
    // Mounted with nothing to describe, hours before it gets a timestamp.
    expect(render(undefined)).toBe('(none)');
    act(() => {
      jest.advanceTimersByTime(8 * 60 * MINUTE);
    });

    // Against the mount-time clock this would read "in 7 hours".
    expect(render(Date.now() - 60 * MINUTE)).toBe('an hour ago');
  });

  it('never renders a timestamp from the current interval as future', () => {
    render(START - MINUTE);
    // The label follows the clock only every `intervalMs`, so a timestamp
    // from within the current interval sits after the reference.
    expect(render(START + 20_000)).toBe('a few seconds ago');
  });
});
