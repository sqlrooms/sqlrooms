import {useEffect, useState} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';

/**
 * Formatted "x ago" label for `timestamp`, refreshed as wall-clock time moves
 * on. Returns undefined when there is no timestamp.
 *
 * @param timestamp Epoch ms to describe.
 * @param intervalMs How often to re-read the clock. Defaults to 30s.
 */
export function useRelativeTime(
  timestamp: number | undefined,
  intervalMs = 30_000,
): string | undefined {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (timestamp == null) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [timestamp, intervalMs]);

  return timestamp == null ? undefined : formatTimeRelative(timestamp, now);
}
