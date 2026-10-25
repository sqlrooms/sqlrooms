import {readFileSync} from 'node:fs';
import {
  HarnessRunEvent,
  HarnessConversationSnapshot,
  type HarnessRun,
} from '@sqlrooms/ai-config';
import {
  createHarnessRunStore,
  applyHarnessRunEvent,
  projectHarnessMessages,
} from '../src/harnessRunState';
import {createHarnessReplayClient} from '../src/harnessReplayClient';
const run: HarnessRun = {
  runId: 'run',
  conversationId: 'conversation',
  turnId: 'turn',
  principalId: 'owner',
  status: 'running',
  nativeSessionId: null,
  skillHash: 'hash',
  deadlineAt: '2026-10-25T13:00:00Z',
  capabilities: {
    liveInput: false,
    continueSession: false,
    approvalRecovery: false,
    cancelTurn: true,
    reasoningSummary: false,
    planUpdates: false,
    usage: false,
  },
};
const event = (
  seq: number,
  kind: string,
  payload: HarnessRunEvent['payload'],
): HarnessRunEvent => ({
  schemaVersion: 1,
  seq,
  eventId: `e${seq}`,
  conversationId: 'conversation',
  runId: 'run',
  at: '2026-10-25T12:00:00Z',
  principalId: 'owner',
  kind,
  payload,
});
const approval = {
  approvalId: 'approval',
  runId: 'run',
  callId: 'call',
  summary: 'Execute command?',
  options: ['approve', 'deny'],
  decision: null,
  resolvedBy: null,
};
describe('host-owned harness replay', () => {
  it('validates and renders the recorded browserless Codex revenue run', async () => {
    const events = JSON.parse(
      readFileSync(
        new URL(
          '../../ai-config/fixtures/harness-v1/codex-revenue.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ).map((value: unknown) => HarnessRunEvent.parse(value));
    const store = createHarnessRunStore();
    for (const value of events) applyHarnessRunEvent(store, value);
    expect(store.getState().run?.status).toBe('succeeded');
    const transcript = JSON.stringify(
      projectHarnessMessages(store.getState().events),
    );
    expect(transcript).toContain('300.00');
    expect(transcript).toContain('450.00');
    expect(transcript).toContain('execute_command');
  });
  it('deduplicates reconnect deliveries and projects each message exactly once', () => {
    const store = createHarnessRunStore();
    const events = [
      event(1, 'run.status', {status: 'running', run}),
      event(2, 'message.text', {messageId: 'm', text: 'Hello'}),
      event(3, 'message.text', {messageId: 'm', text: ' world'}),
    ];
    for (const value of [...events.slice(0, 2), ...events])
      applyHarnessRunEvent(store, value);
    expect(store.getState().events).toHaveLength(3);
    expect(
      projectHarnessMessages(store.getState().events).at(-1)?.parts,
    ).toEqual([{type: 'text', text: 'Hello world'}]);
  });
  it('accepts a run started by another client and its terminal descriptor', () => {
    const store = createHarnessRunStore();
    applyHarnessRunEvent(
      store,
      event(1, 'run.status', {status: 'running', run}),
    );
    expect(store.getState().run).toEqual(run);
    applyHarnessRunEvent(
      store,
      event(2, 'run.status', {
        status: 'succeeded',
        run: {...run, status: 'succeeded'},
      }),
    );
    expect(store.getState().run?.status).toBe('succeeded');
  });
  it('keeps one approval card through replay and retains the owner decision in history', () => {
    const store = createHarnessRunStore();
    const requested = event(1, 'approval.requested', approval);
    applyHarnessRunEvent(store, requested);
    applyHarnessRunEvent(store, requested);
    expect(store.getState().pendingApprovals).toHaveLength(1);
    applyHarnessRunEvent(
      store,
      event(2, 'approval.resolved', {
        ...approval,
        decision: 'deny',
        resolvedBy: 'owner',
      }),
    );
    expect(store.getState().pendingApprovals).toHaveLength(0);
    expect(
      JSON.stringify(projectHarnessMessages(store.getState().events)),
    ).toContain('Approval deny by owner');
  });
  it('renders failed tools and unknown future events without assuming success', () => {
    const messages = projectHarnessMessages([
      event(1, 'tool.completed', {callId: 'call', status: 'failed'}),
      event(2, 'future.kind', {summary: 'Future event'}),
    ]);
    expect(messages[0]?.parts[0]).toMatchObject({state: 'output-error'});
    expect(JSON.stringify(messages[1])).toContain('future.kind: Future event');
  });
  it('replay client sends only events after the cursor and rejects writes', async () => {
    const events = [
      event(1, 'message.text', {messageId: 'm', text: 'Recorded'}),
      event(2, 'message.completed', {messageId: 'm', status: 'completed'}),
    ];
    const snapshot = HarnessConversationSnapshot.parse({
      conversationId: 'conversation',
      lastSeq: 2,
      events,
      runs: [run],
      pendingApprovals: [],
    });
    const client = createHarnessReplayClient(snapshot);
    const received: HarnessRunEvent[] = [];
    const stop = client.subscribe(1, (value) => received.push(value));
    await Promise.resolve();
    stop();
    expect(received).toEqual([events[1]]);
    await expect(
      client.resolveApproval({approvalId: 'approval', decision: 'approve'}),
    ).rejects.toThrow('read-only');
  });
});
