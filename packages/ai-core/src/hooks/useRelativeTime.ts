import {useCallback, useSyncExternalStore} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';

/** How often the shared clock re-reads wall-clock time. */
const CLOCK_TICK_MS = 1_000;

// One clock shared by every relative label. Reading the time from component
// state would freeze it at the moment that component first rendered, so a
// label mounted long before it had a timestamp to describe — or re-pointed at
// a new one — would measure it against a stale reference. An external store
// keeps the reference current for all of them at the cost of a single timer.
let clockNow = Date.now();
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();

function subscribeToClock(onChange: () => void): () => void {
  // The timer only runs while something is listening, so it may have been
  // stopped for a while; re-read before handing the value out.
  clockNow = Date.now();
  clockListeners.add(onChange);
  clockTimer ??= setInterval(() => {
    clockNow = Date.now();
    for (const listener of clockListeners) listener();
  }, CLOCK_TICK_MS);
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && clockTimer !== undefined) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

/**
 * Formatted "x ago" label for `timestamp`, refreshed as wall-clock time moves
 * on. Returns undefined when there is no timestamp.
 *
 * @param timestamp Epoch ms to describe.
 * @param intervalMs How coarsely the label follows the clock. Defaults to 30s,
 *   so the shared 1s tick only re-renders a label four times a minute at most.
 */
export function useRelativeTime(
  timestamp: number | undefined,
  intervalMs = 30_000,
): string | undefined {
  // Quantizing the shared clock is what keeps the tick cheap: the snapshot is
  // unchanged for most ticks, so React bails out instead of re-rendering
  // every label on screen once a second.
  const getSnapshot = useCallback(
    () => Math.floor(clockNow / intervalMs) * intervalMs,
    [intervalMs],
  );
  const now = useSyncExternalStore(subscribeToClock, getSnapshot, getSnapshot);

  if (timestamp == null) return undefined;
  // Quantizing rounds the reference down, so a timestamp from the current
  // interval can sit after it. Clamp rather than describe it as the future.
  return formatTimeRelative(timestamp, Math.max(now, timestamp));
}
