import {useState, useEffect, useMemo} from 'react';
import {formatShortDuration} from '@sqlrooms/utils';

/**
 * Hook that tracks elapsed wall-clock time for a running/completed operation.
 *
 * Takes explicit `startedAt` and `completedAt` timestamps (matching the
 * AgentToolCall pattern) rather than relying on module-level caches.
 * While running, ticks every second; once stopped, returns frozen elapsed.
 *
 * @param isRunning Whether the operation is still in progress.
 * @param startedAt Epoch-ms when the operation started (undefined suppresses output).
 * @param completedAt Epoch-ms when the operation finished (undefined while running).
 * @returns A formatted string like "3s" or "14m 49s", or undefined when < 1 s or no data.
 */
export function useElapsedTime(
  isRunning: boolean,
  startedAt?: number,
  completedAt?: number,
): string | undefined {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt == null || !isRunning) return;

    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning, startedAt]);

  const elapsed = useMemo(() => {
    if (startedAt == null) return 0;
    if (!isRunning) {
      return completedAt != null ? completedAt - startedAt : tick - startedAt;
    }
    return tick - startedAt;
  }, [isRunning, startedAt, completedAt, tick]);

  if (startedAt == null) return undefined;
  if (isRunning) {
    return elapsed >= 1000 ? formatShortDuration(elapsed) : undefined;
  }
  return formatShortDuration(elapsed);
}
