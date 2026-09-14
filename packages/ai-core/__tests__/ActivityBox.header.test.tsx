/**
 * @jest-environment jsdom
 *
 * The activity header's two states: a running activity reports the live clock
 * and the step underway and stays pinned open; a settled one reports how long
 * it took and can be collapsed.
 */
import {jest} from '@jest/globals';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {
  ActivityBox,
  type ActivityBoxProps,
} from '../src/components/ActivityBox';

/** jsdom has no ResizeObserver; the box only observes to measure overflow. */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  ResizeObserver: ResizeObserverStub,
});

const START = new Date('2026-01-01T12:00:00Z').getTime();

let container: HTMLDivElement;
let root: Root;

function render(props: Partial<ActivityBoxProps>) {
  act(() =>
    root.render(
      <ActivityBox startedAt={START} {...props}>
        <div>log line</div>
      </ActivityBox>,
    ),
  );
}

function header(): HTMLButtonElement | null {
  return container.querySelector('button');
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

describe('ActivityBox header', () => {
  it('reports the live clock and the step underway while running', () => {
    render({isRunning: true, summaryLabel: 'Thinking', stepCount: 3});
    act(() => {
      jest.advanceTimersByTime(12_000);
    });
    expect(header()?.textContent).toBe('Thinking· 12s · step 3');
  });

  it('stays pinned open while running', () => {
    render({isRunning: true, summaryLabel: 'Thinking', stepCount: 1});
    expect(header()?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('log line');

    // The disclosure is inert while running, so there is nothing to click
    // the activity away with.
    act(() => header()?.click());

    expect(header()?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('log line');
  });

  it('reports the aggregated duration once settled', () => {
    render({
      summaryLabel: 'Worked with 3 tools',
      stepCount: 3,
      computationTimeLabel: 'Computation Time: 12s',
    });
    expect(header()?.textContent).toBe(
      'Worked with 3 tools· Computation Time: 12s',
    );
  });

  it('falls back to the step count when no duration was supplied', () => {
    render({summaryLabel: 'Worked with 1 tool', stepCount: 1});
    expect(header()?.textContent).toBe('Worked with 1 tool· 1 step');
  });

  it('hides the activity behind the summary until the header is clicked', () => {
    render({summaryLabel: 'Worked with 3 tools', stepCount: 3});
    expect(header()?.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('log line');

    act(() => header()?.click());

    expect(header()?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('log line');
  });

  it('shows the activity with no header when there is nothing to summarize', () => {
    render({stepCount: 3});
    expect(header()).toBeNull();
    expect(container.textContent).toContain('log line');
  });
});
