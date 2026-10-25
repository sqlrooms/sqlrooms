import {
  HarnessRunEvent,
  type HarnessConversationSnapshot,
} from '@sqlrooms/ai-config';
import type {HarnessRunClient} from './harnessRunTypes';

/** Read-only fixture client for rendering recorded host events without a model or network. */
export function createHarnessReplayClient(
  snapshot: HarnessConversationSnapshot,
): HarnessRunClient {
  const events = snapshot.events.map((event) => HarnessRunEvent.parse(event));
  const unsupported = async (): Promise<never> => {
    throw new Error('Recorded replay is read-only.');
  };
  return {
    snapshot: async () => structuredClone({...snapshot, events}),
    history: async (after) =>
      structuredClone(events.filter((event) => event.seq > after)),
    subscribe(after, listener) {
      let active = true;
      queueMicrotask(() => {
        if (active)
          for (const event of events)
            if (event.seq > after) listener(structuredClone(event));
      });
      return () => {
        active = false;
      };
    },
    startTurn: unsupported,
    sendInput: unsupported,
    cancel: unsupported,
    resolveApproval: unsupported,
    fetchBlob: unsupported,
  };
}
