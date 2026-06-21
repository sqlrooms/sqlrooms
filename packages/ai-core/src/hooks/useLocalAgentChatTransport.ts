import {
  createAgentUIStreamResponse,
  DefaultChatTransport,
  type ToolLoopAgent,
  type UIMessage,
} from 'ai';
import {useMemo} from 'react';

/**
 * Build a local `useChat` transport that drives a pre-constructed
 * `ToolLoopAgent` directly instead of calling an HTTP endpoint.
 */
export function useLocalAgentChatTransport(
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

export function parseLocalAgentUiMessages(
  body: BodyInit | null | undefined,
): UIMessage[] {
  return parseUiMessages(body);
}

function parseUiMessages(body: BodyInit | null | undefined): UIMessage[] {
  if (!body) return [];
  if (typeof body !== 'string') {
    console.warn(
      '[useLocalAgentChatTransport] Unexpected non-string request body:',
      Object.prototype.toString.call(body),
    );
    return [];
  }
  try {
    const parsed = JSON.parse(body) as {messages?: UIMessage[]};
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch (err) {
    console.warn(
      '[useLocalAgentChatTransport] Failed to parse request body:',
      err,
      body.slice(0, 200),
    );
    return [];
  }
}
