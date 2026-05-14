import {useEffect, useRef} from 'react';
import {useStoreWithAi} from '../AiSlice';

/**
 * Records start/complete timestamps for a tool call into the store's
 * toolTimings map. This enables UI components to show live elapsed
 * time during execution and persist the final duration across reloads.
 *
 * - On first render with a given toolCallId that is not yet complete,
 *   records `startedAt`.
 * - When `isComplete` transitions from false to true, records `completedAt`.
 * - Skips recording entirely if an entry already exists in the store
 *   (e.g. rehydrated from persisted data).
 * - Skips recording if the tool is already complete on first render
 *   (old project loaded from disk with no timing data — recording
 *   now would produce a misleading zero-duration entry).
 */
export function useToolTimingRecorder(
  toolCallId: string | undefined,
  isComplete: boolean,
): void {
  const setToolTiming = useStoreWithAi((s) => s.ai.setToolTiming);
  const existingTiming = useStoreWithAi((s) =>
    toolCallId ? s.ai.toolTimings[toolCallId] : undefined,
  );

  const startedAtRef = useRef<number | undefined>(undefined);
  const recordedCompleteRef = useRef(false);
  // Track the initial isComplete value to distinguish between reloaded
  // (already-complete) tools and tools that complete during this session.
  const initialCompleteRef = useRef(isComplete);

  useEffect(() => {
    if (!toolCallId) return;
    if (existingTiming) return;
    // Already complete on mount — this is a reload of an old project
    // without persisted timing. Skip to avoid a misleading 0s entry.
    if (initialCompleteRef.current) return;

    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
      setToolTiming(toolCallId, {startedAt: startedAtRef.current});
    }
  }, [toolCallId, existingTiming, setToolTiming]);

  useEffect(() => {
    if (!toolCallId || !isComplete || recordedCompleteRef.current) return;
    if (existingTiming?.completedAt != null) return;
    // Same guard: if the tool was already complete on first render, skip.
    if (initialCompleteRef.current && !startedAtRef.current) return;

    recordedCompleteRef.current = true;
    const startedAt =
      existingTiming?.startedAt ?? startedAtRef.current ?? Date.now();
    setToolTiming(toolCallId, {startedAt, completedAt: Date.now()});
  }, [toolCallId, isComplete, existingTiming, setToolTiming]);
}
