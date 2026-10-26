import {createStore} from 'zustand/vanilla';
import type {UIMessage} from 'ai';
import {
  HarnessRunEvent,
  HarnessApproval,
  HarnessRun,
} from '@sqlrooms/ai-config';

/** Project conversation/tool messages; native and unknown events stay in the diagnostic log. */
export function projectHarnessMessages(events: HarnessRunEvent[]): UIMessage[] {
  const messages = new Map<string, UIMessage>();
  const outputs = new Map<string, Record<string, unknown>>();
  for (const event of events) {
    const payload = event.payload;
    if (event.kind === 'message.user')
      messages.set(event.eventId, {
        id: event.eventId,
        role: 'user',
        parts: [{type: 'text', text: String(payload.text)}],
      });
    else if (event.kind === 'message.text') {
      const id = `${event.runId}:${String(payload.messageId)}`;
      const previous = messages.get(id);
      const text =
        previous?.parts[0]?.type === 'text' ? previous.parts[0].text : '';
      messages.set(id, {
        id,
        role: 'assistant',
        parts: [{type: 'text', text: text + String(payload.text)}],
      });
    } else if (
      ['tool.started', 'tool.output', 'tool.completed'].includes(event.kind)
    ) {
      const id = `${event.runId}:tool:${String(payload.callId)}`;
      const previous = messages.get(id)?.parts[0];
      const tool = previous?.type === 'dynamic-tool' ? previous : undefined;
      const oldOutput = outputs.get(id);
      const output = {
        ...oldOutput,
        ...(event.kind === 'tool.completed'
          ? {result: payload.result, artifactRefs: payload.artifactRefs}
          : {}),
        logs:
          String(oldOutput?.logs ?? '') +
          (event.kind === 'tool.output' ? String(payload.chunk ?? '') : ''),
      };
      outputs.set(id, output);
      const failed = [
        'failed',
        'denied',
        'declined',
        'cancelled',
        'interrupted',
      ].includes(String(payload.status));
      messages.set(id, {
        id,
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolCallId: id,
            toolName: String(payload.name ?? tool?.toolName ?? 'Tool'),
            input: payload.input ?? tool?.input,
            ...(event.kind === 'tool.completed'
              ? failed
                ? {
                    state: 'output-error' as const,
                    errorText: String(payload.status),
                  }
                : {state: 'output-available' as const, output}
              : {state: 'input-available' as const}),
          },
        ],
      });
    } else if (event.kind === 'run.status') {
      if (
        ['succeeded', 'failed', 'cancelled', 'interrupted'].includes(
          String(payload.status),
        )
      ) {
        for (const [id, message] of messages) {
          const part = message.parts[0];
          if (
            id.startsWith(`${event.runId}:tool:`) &&
            part?.type === 'dynamic-tool' &&
            part.state === 'input-available'
          ) {
            messages.set(id, {
              ...message,
              parts: [
                {
                  type: 'dynamic-tool',
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: part.input,
                  state: 'output-error',
                  errorText:
                    payload.status === 'succeeded'
                      ? 'Run ended without a tool result'
                      : String(payload.status),
                },
              ],
            });
          }
        }
      }

      messages.set(event.eventId, {
        id: event.eventId,
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `${String(payload.status)}${payload.reason ? ': ' + String(payload.reason) : ''}`,
          },
        ],
      });
    } else if (
      event.kind === 'turn.started' &&
      payload.origin === 'continuation' &&
      payload.nativeContextResumed === false
    ) {
      messages.set(event.eventId, {
        id: event.eventId,
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'New turn: native session context was not resumed. The workspace content and conversation history remain available.',
          },
        ],
      });
    } else if (event.kind.startsWith('approval.')) {
      messages.set(event.eventId, {
        id: event.eventId,
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text:
              event.kind === 'approval.requested'
                ? `Approval requested: ${String(payload.summary)}`
                : `Approval ${String(payload.decision)} by ${String(payload.resolvedBy)}`,
          },
        ],
      });
    }
  }
  return [...messages.values()];
}
/** Replay store deduplicates transport delivery before projecting UI messages. */
export function createHarnessRunStore() {
  return createStore<{
    events: HarnessRunEvent[];
    lastSeq: number;
    run?: HarnessRun;
    pendingApprovals: HarnessApproval[];
    prompt: string;
    queued: string;
    error?: string;
    ready: boolean;
    sending: boolean;
  }>()(() => ({
    events: [],
    lastSeq: 0,
    pendingApprovals: [],
    prompt: '',
    queued: '',
    ready: false,
    sending: false,
  }));
}
/** Add one validated event in sequence order; duplicates never append message text twice. */
export function applyHarnessRunEvent(
  store: ReturnType<typeof createHarnessRunStore>,
  raw: HarnessRunEvent,
) {
  const event = HarnessRunEvent.parse(raw);
  const state = store.getState();
  if (event.seq <= state.lastSeq) return;
  let run = state.run;
  if (event.kind === 'run.status') {
    if (event.payload.run) run = HarnessRun.parse(event.payload.run);
    else if (run?.runId === event.runId)
      run = {...run, status: HarnessRunStatusValue(event.payload.status)};
  }
  let pendingApprovals = state.pendingApprovals;
  if (event.kind === 'approval.requested')
    pendingApprovals = [
      ...pendingApprovals.filter(
        (value) => value.approvalId !== event.payload.approvalId,
      ),
      HarnessApproval.parse(event.payload),
    ];
  if (event.kind === 'approval.resolved')
    pendingApprovals = pendingApprovals.filter(
      (value) => value.approvalId !== event.payload.approvalId,
    );
  store.setState({
    events: [...state.events, event],
    lastSeq: event.seq,
    run,
    pendingApprovals,
  });
}
function HarnessRunStatusValue(value: unknown): HarnessRun['status'] {
  return value as HarnessRun['status']; // HarnessRunEvent validates known payloads at the boundary.
}
