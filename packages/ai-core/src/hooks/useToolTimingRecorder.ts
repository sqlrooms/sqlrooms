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
 * - Records completion only after this mounted recorder observed the tool
 *   pending, so rehydrated timings never include an offline/reload gap.
 * - Skips recording if the tool is already complete on first render.
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
  const observedPendingRef = useRef(!isComplete);

  useEffect(() => {
    if (!toolCallId || isComplete) return;
    observedPendingRef.current = true;
    if (existingTiming) return;

    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
      setToolTiming(toolCallId, {startedAt: startedAtRef.current});
    }
  }, [toolCallId, isComplete, existingTiming, setToolTiming]);

  useEffect(() => {
    if (!toolCallId || !isComplete || recordedCompleteRef.current) return;
    if (existingTiming?.completedAt != null) return;
    if (!observedPendingRef.current) return;

    recordedCompleteRef.current = true;
    const startedAt =
      existingTiming?.startedAt ?? startedAtRef.current ?? Date.now();
    setToolTiming(toolCallId, {startedAt, completedAt: Date.now()});
  }, [toolCallId, isComplete, existingTiming, setToolTiming]);
}
