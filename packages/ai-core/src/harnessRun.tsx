import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {useStore} from 'zustand';
import type {HarnessRun} from '@sqlrooms/ai-config';
import type {HarnessRunClient, HarnessRunChatRuntime} from './harnessRunTypes';
import {
  ChatRuntimeContext,
  useChatRuntime,
} from './components/ChatRuntimeContext';
import {
  createHarnessRunStore,
  applyHarnessRunEvent,
  projectHarnessMessages,
} from './harnessRunState';
export {
  createHarnessRunStore,
  applyHarnessRunEvent,
  projectHarnessMessages,
} from './harnessRunState';
import {LocalAgentChatMessages} from './components/LocalAgentChatMessages';

export type {HarnessRunClient, HarnessRunChatRuntime} from './harnessRunTypes';
const active = (run?: HarnessRun) =>
  !!run &&
  ['queued', 'running', 'awaiting-input', 'awaiting-approval'].includes(
    run.status,
  );
/** Snapshot, bounded history paging, and live replay provider for one conversation. */
export function HarnessRunChatRoot({
  client,
  conversationId,
  children,
  onConversation,
}: PropsWithChildren<{
  client: HarnessRunClient;
  conversationId?: string;
  onConversation?: (id: string) => void;
}>) {
  const store = useMemo(
    () => ({conversationId, client, value: createHarnessRunStore()}),
    [client, conversationId],
  ).value;
  const events = useStore(store, (state) => state.events);
  const run = useStore(store, (state) => state.run);
  const pendingApprovals = useStore(store, (state) => state.pendingApprovals);
  const prompt = useStore(store, (state) => state.prompt);
  const error = useStore(store, (state) => state.error);
  const queued = useStore(store, (state) => state.queued);
  const ready = useStore(store, (state) => state.ready);
  const setPrompt = useCallback(
    (prompt: string) => store.setState({prompt}),
    [store],
  );
  const setError = useCallback(
    (error: string | undefined) => store.setState({error}),
    [store],
  );
  const setQueued = (queued: string) => store.setState({queued});
  const setReady = useCallback(
    (ready: boolean) => store.setState({ready}),
    [store],
  );
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    if (!conversationId) {
      setReady(true);
      return;
    }
    setReady(false);
    void (async () => {
      const snapshot = await client.snapshot(conversationId);
      let history = snapshot.events;
      let after = snapshot.historyAfterSeq;
      while (snapshot.historyHasMore && after < snapshot.lastSeq) {
        const page = (await client.history(after, conversationId)).filter(
          (event) => event.seq <= snapshot.lastSeq,
        );
        if (!page.length) break;
        history = [...history, ...page];
        after = page.at(-1)!.seq;
      }
      if (!alive) return;
      store.setState({
        events: history,
        lastSeq: snapshot.lastSeq,
        run: snapshot.runs.at(-1),
        pendingApprovals: snapshot.pendingApprovals,
      });
      unsubscribe = client.subscribe(snapshot.lastSeq, (event) => {
        if (event.conversationId !== conversationId) return;
        applyHarnessRunEvent(store, event);
      });
      setReady(true);
    })().catch((error) => {
      if (alive) setError(String(error));
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [client, conversationId, store, setError, setReady]);
  const messages = useMemo(() => projectHarnessMessages(events), [events]);
  const send = useCallback(
    async (text: string) => {
      setError(undefined);
      try {
        const next = await client.startTurn({
          idempotencyKey: crypto.randomUUID(),
          conversationId,
          text,
        });
        if (
          !store.getState().events.some((event) => event.runId === next.runId)
        )
          store.setState({run: next});
        onConversation?.(next.conversationId);
        setPrompt('');
      } catch (error) {
        setError(String(error));
      }
    },
    [client, conversationId, onConversation, setError, setPrompt, store],
  );
  useEffect(
    () =>
      store.subscribe((state) => {
        if (state.ready && state.queued && !active(state.run)) {
          const text = state.queued;
          store.setState({queued: ''});
          void send(text);
        }
      }),
    [store, send],
  );
  const runtime: HarnessRunChatRuntime = {
    mode: 'harness-run',
    messages,
    status: active(run) ? 'streaming' : 'ready',
    isStreaming: active(run),
    prompt,
    setPrompt,
    sendPrompt(value) {
      const text = (value ?? prompt).trim();
      if (!text || !ready) return;
      if (active(run)) {
        if (run?.capabilities.liveInput)
          void client
            .sendInput({runId: run.runId, text})
            .catch((error) => setError(String(error)));
        else {
          setQueued(text);
          setPrompt('');
        }
      } else void send(text);
    },
    stop: async () => {
      if (run)
        try {
          await client.cancel(run.runId);
        } catch (error) {
          setError(String(error));
        }
    },
    initialSuggestions: [],
    suggestionsVisible: false,
    setSuggestionsVisible: () => {},
    events,
    pendingApprovals,
    run,
    error,
    queued,
    async resolveApproval(approvalId, decision) {
      try {
        await client.resolveApproval({approvalId, decision});
      } catch (error) {
        setError(String(error));
      } finally {
        if (conversationId) {
          try {
            const snapshot = await client.snapshot(conversationId);
            if (snapshot.lastSeq === store.getState().lastSeq)
              store.setState({pendingApprovals: snapshot.pendingApprovals});
          } catch (error) {
            setError(String(error));
          }
        }
      }
    },
    fetchBlob: client.fetchBlob,
  };
  return (
    <ChatRuntimeContext.Provider value={runtime}>
      {children}
    </ChatRuntimeContext.Provider>
  );
}
/** Owner approval cards; absence of a decision leaves the host waiting. */
export function HarnessRunApprovals() {
  const runtime = useChatRuntime();
  if (runtime.mode !== 'harness-run') return null;
  return (
    <div aria-label="Pending approvals">
      {runtime.pendingApprovals.map((value) => (
        <div key={value.approvalId} className="m-2 rounded border p-3">
          <p>{value.summary}</p>
          {value.options.map((decision) => (
            <button
              className="m-2 rounded border px-3 py-1"
              key={decision}
              onClick={() =>
                void runtime.resolveApproval(value.approvalId, decision)
              }
            >
              {decision}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
/** Minimal composer, queue indication, errors, and explicit cancellation. */
export function HarnessRunControls() {
  const runtime = useChatRuntime();
  if (runtime.mode !== 'harness-run') return null;
  return (
    <div className="border-t p-3">
      {runtime.error && <p role="alert">{runtime.error}</p>}
      <p>
        {runtime.run?.status ?? 'Ready'} · {runtime.pendingApprovals.length}{' '}
        pending approvals
      </p>
      {runtime.queued && <p>Queued for next turn: {runtime.queued}</p>}
      <textarea
        aria-label="Message Roomie"
        className="w-full border p-2"
        value={runtime.prompt}
        onChange={(event) => runtime.setPrompt(event.target.value)}
      />
      <button
        className="m-1 rounded border px-3 py-1"
        onClick={() => runtime.sendPrompt()}
      >
        {runtime.isStreaming && !runtime.run?.capabilities.liveInput
          ? 'Queue next turn'
          : 'Send'}
      </button>
      {runtime.isStreaming && (
        <button
          className="m-1 rounded border px-3 py-1"
          onClick={() => void runtime.stop()}
        >
          Stop
        </button>
      )}
    </div>
  );
}
/** Inspect retained tool output as plain text, with explicit blob retrieval. */
export function HarnessRunDetails({
  onArtifact,
}: {onArtifact?: (artifactId: string) => void} = {}) {
  const runtime = useChatRuntime();
  const [blobs, setBlobs] = useState<Record<string, string>>({});
  if (runtime.mode !== 'harness-run') return null;
  return (
    <details className="max-h-60 overflow-auto border-t p-2">
      <summary>Tool activity and event details</summary>
      {runtime.events
        .filter((event) => event.kind.startsWith('tool.') || event.blobRef)
        .map((event) => (
          <details key={event.eventId}>
            <summary>
              {String(event.payload.name ?? event.kind)} ·{' '}
              {String(event.payload.status ?? '')}
            </summary>
            {Array.isArray(event.payload.artifactRefs) &&
              event.payload.artifactRefs.map((ref, index) =>
                ref &&
                typeof ref === 'object' &&
                'artifactId' in ref &&
                typeof ref.artifactId === 'string' ? (
                  <button
                    key={index}
                    className="m-2 underline"
                    onClick={() => onArtifact?.(String(ref.artifactId))}
                    disabled={!onArtifact}
                  >
                    Open document {ref.artifactId}
                  </button>
                ) : null,
              )}
            <pre className="text-xs break-all whitespace-pre-wrap">
              {(event.blobRef && blobs[event.blobRef]) ||
                JSON.stringify(event.payload, null, 2)}
            </pre>
            {event.blobRef && !blobs[event.blobRef] && (
              <button
                onClick={() => {
                  const ref = event.blobRef!;
                  void runtime
                    .fetchBlob(ref)
                    .then((value) =>
                      setBlobs((current) => ({...current, [ref]: value})),
                    )
                    .catch((error) =>
                      setBlobs((current) => ({
                        ...current,
                        [ref]: String(error),
                      })),
                    );
                }}
              >
                Load full output
              </button>
            )}
          </details>
        ))}
    </details>
  );
}
/** Compound chat surface reusing the existing AI message renderer without a model loop. */
export const HarnessRunChat = {
  Root: HarnessRunChatRoot,
  Messages: LocalAgentChatMessages,
  Approvals: HarnessRunApprovals,
  Controls: HarnessRunControls,
  Details: HarnessRunDetails,
};
