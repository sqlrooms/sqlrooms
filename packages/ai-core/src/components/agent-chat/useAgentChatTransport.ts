import {
  createAgentUIStreamResponse,
  DefaultChatTransport,
  type ToolLoopAgent,
  type UIMessage,
} from 'ai';
import {useMemo} from 'react';

/**
 * Build a `DefaultChatTransport` that bypasses HTTP and drives a
 * locally-constructed `ToolLoopAgent` directly. The returned transport is the
 * shape `useChat` expects; we fulfill its `fetch` contract by parsing the
 * request body for the `messages` array, handing them to
 * `createAgentUIStreamResponse`, and returning the resulting `Response`.
 */
export function useAgentChatTransport(
  agent: ToolLoopAgent<any, any, any>,
): DefaultChatTransport<UIMessage> {
  return useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        fetch: (async (_url: RequestInfo | URL, init?: RequestInit) => {
          const uiMessages = parseUiMessages(init?.body);
          return createAgentUIStreamResponse({
            agent,
            uiMessages,
            abortSignal: init?.signal ?? undefined,
          });
        }) as unknown as typeof fetch,
      }),
    [agent],
  );
}

function parseUiMessages(body: BodyInit | null | undefined): UIMessage[] {
  if (!body) return [];
  try {
    const parsed = JSON.parse(String(body)) as {messages?: UIMessage[]};
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch {
    return [];
  }
}
