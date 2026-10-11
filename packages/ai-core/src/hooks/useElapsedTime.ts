import {useEffect, useState} from 'react';
import {formatShortDuration} from '@sqlrooms/utils';

/**
 * Returns a formatted elapsed-time string that auto-updates every second
 * while the operation is running. Returns a static formatted duration
 * when completed, or undefined when there is no timing data.
 */
export function useElapsedTime(
  isRunning: boolean,
  startedAt?: number,
  completedAt?: number,
): string | undefined {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning || startedAt == null) return;
    const update = () => setNow(Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isRunning, startedAt]);

  if (startedAt == null) return undefined;

  if (completedAt != null) {
    return formatShortDuration(completedAt - startedAt);
  }

  // Not running and no completedAt — this is a reloaded session with no
  // persisted completion timestamp. Return nothing instead of computing a
  // misleading elapsed time from the old startedAt to now.
  if (!isRunning) return undefined;

  const elapsed = now - startedAt;
  if (elapsed < 1000) return undefined;
  return formatShortDuration(elapsed);
}
