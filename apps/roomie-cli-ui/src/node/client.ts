import {
  HarnessConversationSnapshot,
  HarnessRunEvent,
  HarnessRun,
} from '@sqlrooms/ai-config';
import type {HarnessRunClient} from '@sqlrooms/ai-core';
import {authorizedFetch, pageCredential} from './auth';

/** Authenticated host request; credentials are never stored in event payloads or URLs. */
export async function hostRequest(path: string, body?: unknown) {
  const response = await authorizedFetch(
    path,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Host request failed.');
  return result;
}
/** Subscription with bounded retry and committed-cursor replay; closing it never cancels a run. */
export function subscribeHost(options: {
  afterSeq?: number;
  onEvent?: (event: HarnessRunEvent) => void;
  onContent?: (content: unknown) => void;
  onStatus?: (status: string) => void;
}) {
  let stopped = false,
    socket: WebSocket | undefined,
    retry: ReturnType<typeof setTimeout> | undefined;
  let afterSeq = options.afterSeq;
  function connect() {
    if (stopped) return;
    socket = new WebSocket(
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
    );
    socket.onopen = () =>
      socket?.send(JSON.stringify({type: 'auth', token: pageCredential()}));
    socket.onmessage = (message) => {
      try {
        const frame = JSON.parse(String(message.data));
        if (frame.type === 'authAck') {
          options.onStatus?.('Connected');
          if (options.onContent)
            socket?.send(
              JSON.stringify({type: 'crdt-join', roomId: 'workspace'}),
            );
          if (afterSeq !== undefined)
            socket?.send(JSON.stringify({type: 'run-subscribe', afterSeq}));
        } else if (frame.type === 'crdt-snapshot')
          options.onContent?.(frame.content);
        else if (frame.type === 'run-event') {
          const event = HarnessRunEvent.parse(frame.event);
          if (event.seq > (afterSeq ?? 0)) {
            options.onEvent?.(event);
            afterSeq = event.seq;
          }
        } else if (frame.type === 'error')
          options.onStatus?.(String(frame.error));
      } catch {
        options.onStatus?.('Invalid host event.');
        socket?.close();
      }
    };
    socket.onclose = () => {
      options.onStatus?.('Disconnected; reconnecting');
      if (!stopped) retry = setTimeout(connect, 1000);
    };
  }
  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    socket?.close();
  };
}
/** Production client for the shared harness UI contract. */
export const harnessClient: HarnessRunClient = {
  snapshot: async (id) =>
    HarnessConversationSnapshot.parse(
      await hostRequest(
        `/api/conversations/snapshot?id=${encodeURIComponent(id)}`,
      ),
    ),
  history: async (after, conversationId) =>
    (
      await hostRequest(
        `/api/runs/events?after=${after}&conversationId=${encodeURIComponent(conversationId)}`,
      )
    ).map((event: unknown) => HarnessRunEvent.parse(event)),
  subscribe: (afterSeq, onEvent) => subscribeHost({afterSeq, onEvent}),
  startTurn: async (input) =>
    HarnessRun.parse(await hostRequest('/api/runs/start', input)),
  sendInput: async () => {
    throw new Error('Live input is not supported. Queue a new turn.');
  },
  cancel: async (runId) => {
    await hostRequest('/api/runs/cancel', {runId});
  },
  resolveApproval: async (input) => {
    await hostRequest('/api/approvals/resolve', input);
  },
  fetchBlob: async (ref) =>
    (await hostRequest(`/api/run-blobs?id=${encodeURIComponent(ref)}`)).content,
};
