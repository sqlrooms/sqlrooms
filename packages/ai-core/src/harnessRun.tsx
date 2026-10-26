import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {useStore} from 'zustand';
import {Badge, Button, Textarea} from '@sqlrooms/ui';
import {ChatComposerStateBoundary} from './components/composer/ChatComposerContext';
import {Input, Send, Stop} from './components/composer';
import {ExpandableContent} from './components/ExpandableContent';
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
  startBlockedReason,
}: PropsWithChildren<{
  client: HarnessRunClient;
  conversationId?: string;
  onConversation?: (id: string) => void;
  /** Explains why the host cannot admit a new run from this conversation. */
  startBlockedReason?: string;
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
  const sending = useStore(store, (state) => state.sending);
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
      if (store.getState().sending || startBlockedReason) return;
      store.setState({sending: true});
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
        setPrompt(text);
      } finally {
        store.setState({sending: false});
      }
    },
    [
      client,
      conversationId,
      onConversation,
      setError,
      setPrompt,
      store,
      startBlockedReason,
    ],
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
      if (
        !text ||
        !ready ||
        store.getState().sending ||
        store.getState().queued
      )
        return;
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
      store.setState({queued: ''});
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
    ready,
    sending,
    startBlockedReason,
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
    <div
      aria-label="Pending approvals"
      className="max-h-48 shrink-0 overflow-auto"
    >
      {runtime.pendingApprovals.map((value) => (
        <div key={value.approvalId} className="m-2 rounded border p-3">
          <p>{value.summary}</p>
          {value.options.map((decision) => (
            <Button
              className="m-2"
              variant={decision === 'approve' ? 'default' : 'outline'}
              key={decision}
              onClick={() =>
                void runtime.resolveApproval(value.approvalId, decision)
              }
            >
              {decision}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
/** Shared composer primitives with explicit queue and cancellation semantics. */
export function HarnessRunControls() {
  const runtime = useChatRuntime();
  if (runtime.mode !== 'harness-run') return null;
  return (
    <ChatComposerStateBoundary>
      <div className="shrink-0 space-y-2 border-t p-3">
        {runtime.error && (
          <p role="alert" className="text-destructive text-sm">
            {runtime.error}
          </p>
        )}
        <div role="status" className="flex gap-2 text-xs">
          <Badge variant="secondary">{runtime.run?.status ?? 'Ready'}</Badge>
          {runtime.pendingApprovals.length} pending approvals
        </div>
        {runtime.startBlockedReason && (
          <p role="status" className="text-xs">
            {runtime.startBlockedReason}
          </p>
        )}
        {runtime.queued && (
          <p className="text-xs">Queued for next turn: {runtime.queued}</p>
        )}
        <Input
          asChild
          aria-label="Message"
          placeholder="Ask about this workspace…"
        >
          <Textarea className="max-h-36 min-h-20 resize-none" />
        </Input>
        <div className="flex justify-end gap-2">
          <Stop asChild>
            <Button variant="outline">Stop</Button>
          </Stop>
          <Send asChild>
            <Button>
              {runtime.isStreaming && !runtime.run?.capabilities.liveInput
                ? 'Queue next turn'
                : 'Send'}
            </Button>
          </Send>
        </div>
      </div>
    </ChatComposerStateBoundary>
  );
}

/** Messages and one expandable activity per tool call, with explicit artifact navigation. */
export function HarnessRunMessages({
  className,
  onArtifact,
}: {
  className?: string;
  onArtifact?: (id: string) => void;
}) {
  const runtime = useChatRuntime();
  const events = runtime.mode === 'harness-run' ? runtime.events : undefined;
  const toolEvents = useMemo(() => {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const event of events ?? []) {
      if (!event.kind.startsWith('tool.')) continue;
      const id = `${event.runId}:tool:${String(event.payload.callId)}`;
      const group = groups.get(id) ?? [];
      group.push(event.payload);
      groups.set(id, group);
    }
    return groups;
  }, [events]);
  return (
    <LocalAgentChatMessages
      className={className}
      renderToolDetails={(call) => {
        const output = call.output;
        const refs =
          output &&
          typeof output === 'object' &&
          'artifactRefs' in output &&
          Array.isArray(output.artifactRefs)
            ? output.artifactRefs.filter(
                (ref): ref is {artifactId: string} =>
                  !!ref &&
                  typeof ref === 'object' &&
                  'artifactId' in ref &&
                  typeof ref.artifactId === 'string',
              )
            : [];
        return (
          <div className="space-y-2 p-2">
            {refs.map((ref) => (
              <Button
                key={ref.artifactId}
                variant="link"
                disabled={!onArtifact}
                onClick={() => onArtifact?.(ref.artifactId)}
              >
                Open document {ref.artifactId}
              </Button>
            ))}
            <ExpandableContent maxHeight={160}>
              <pre className="text-xs break-all whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    input: call.input,
                    output: call.output ?? toolEvents.get(call.toolCallId),
                    error: call.errorText,
                  },
                  null,
                  2,
                )}
              </pre>
            </ExpandableContent>
          </div>
        );
      }}
    />
  );
}

/** Native notifications and full retained payloads stay outside assistant prose. */
export function HarnessRunDetails() {
  const runtime = useChatRuntime();
  const [blobs, setBlobs] = useState<Record<string, string>>({});
  if (runtime.mode !== 'harness-run') return null;
  const events = runtime.events.filter(
    (event) =>
      event.blobRef ||
      ![
        'message.user',
        'message.text',
        'message.completed',
        'tool.started',
        'tool.output',
        'tool.completed',
        'run.status',
        'turn.started',
        'turn.completed',
        'approval.requested',
        'approval.resolved',
      ].includes(event.kind),
  );
  return (
    <details className="max-h-60 shrink-0 overflow-auto border-t p-2 text-xs">
      <summary>Diagnostics ({events.length})</summary>
      {events.map((event) => (
        <details key={event.eventId} className="py-1">
          <summary>{String(event.payload.nativeType ?? event.kind)}</summary>
          <pre className="break-all whitespace-pre-wrap">
            {(event.blobRef && blobs[event.blobRef]) ||
              JSON.stringify(event.payload, null, 2)}
          </pre>
          {event.blobRef && !blobs[event.blobRef] && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ref = event.blobRef!;
                void runtime
                  .fetchBlob(ref)
                  .then((value) =>
                    setBlobs((current) => ({...current, [ref]: value})),
                  )
                  .catch((error) =>
                    setBlobs((current) => ({...current, [ref]: String(error)})),
                  );
              }}
            >
              Load full output
            </Button>
          )}
        </details>
      ))}
    </details>
  );
}
/** Compound chat surface reusing shared controls and rendering without a model loop. */
export const HarnessRunChat = {
  Root: HarnessRunChatRoot,
  Messages: HarnessRunMessages,
  Approvals: HarnessRunApprovals,
  Controls: HarnessRunControls,
  Details: HarnessRunDetails,
};
