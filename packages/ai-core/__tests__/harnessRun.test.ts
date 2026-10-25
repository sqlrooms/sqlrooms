import {readFileSync} from 'node:fs';
import {
  HarnessRunEvent,
  HarnessConversationSnapshot,
  HarnessRun,
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
  const fixtures = new URL(
    '../../ai-config/fixtures/harness-v1/',
    import.meta.url,
  );
  const manifest = JSON.parse(
    readFileSync(new URL('manifest.json', fixtures), 'utf8'),
  ) as {
    recordings: {file: string; status: string; textIncludes: string[]}[];
  };
  it.each(manifest.recordings)(
    'validates and replays $file across a disconnect',
    async ({file, status, textIncludes}) => {
      const events: HarnessRunEvent[] = JSON.parse(
        readFileSync(new URL(file, fixtures), 'utf8'),
      ).map((value: unknown) => HarnessRunEvent.parse(value));
      expect(new Set(events.map((e) => e.eventId)).size).toBe(events.length);
      for (let index = 1; index < events.length; index++)
        expect(events[index]!.seq).toBe(events[index - 1]!.seq + 1);
      const runs = new Map<string, HarnessRun>();
      for (const value of events)
        if (value.kind === 'run.status' && value.payload.run) {
          const descriptor = HarnessRun.parse(value.payload.run);
          runs.set(descriptor.runId, descriptor);
        }
      const client = createHarnessReplayClient(
        HarnessConversationSnapshot.parse({
          conversationId: events[0]!.conversationId,
          lastSeq: events.at(-1)!.seq,
          events,
          runs: [...runs.values()],
          pendingApprovals: [],
        }),
      );
      const store = createHarnessRunStore();
      const approvalIndex = events.findIndex(
        (e) => e.kind === 'approval.requested',
      );
      const split =
        approvalIndex < 0 ? Math.floor(events.length / 2) : approvalIndex + 1;
      for (const value of events.slice(0, split))
        applyHarnessRunEvent(store, value);
      if (approvalIndex >= 0)
        expect(store.getState().pendingApprovals).toHaveLength(1);
      // Reconnect from one event before the cursor: duplicates must be harmless.
      const stop = client.subscribe(events[split - 1]!.seq - 1, (value) =>
        applyHarnessRunEvent(store, value),
      );
      await Promise.resolve();
      stop();
      expect(store.getState().events).toEqual(events);
      expect(store.getState().lastSeq).toBe(events.at(-1)!.seq);
      expect(store.getState().run?.status).toBe(status);
      expect(store.getState().pendingApprovals).toHaveLength(0);
      const transcript = JSON.stringify(
        projectHarnessMessages(store.getState().events),
      );
      for (const text of textIncludes) expect(transcript).toContain(text);
      const projectedText = projectHarnessMessages(events)
        .flatMap((m) =>
          m.parts.filter((p) => p.type === 'text').map((p) => p.text),
        )
        .join('');
      // Each complete native text block survives projection, including long answers.
      for (const value of events.filter((e) => e.kind === 'message.text'))
        expect(projectedText).toContain(String(value.payload.text));
      if (file === 'claude-roomie-tools.json') {
        expect(
          events.filter((e) => e.kind === 'tool.started').length,
        ).toBeGreaterThan(10);
        expect(
          events.some(
            (e) =>
              e.kind === 'approval.resolved' &&
              e.payload.decision === 'approve',
          ),
        ).toBe(true);
        expect(
          events.find(
            (e) => e.kind === 'tool.completed' && e.payload.operationId,
          )?.payload,
        ).toMatchObject({
          operationId: 'claude-revenue-fixture-create-v1',
          artifactRefs: [{artifactId: 'awmqfvy17nl7xx7osenvlrtf'}],
          result: {revision: 1},
        });
      }
      if (file === 'claude-approval-denied.json') {
        expect(events.filter((e) => e.kind === 'tool.started')).toHaveLength(1);
        expect(
          events.find((e) => e.kind === 'tool.completed')?.payload.status,
        ).toBe('denied');
        expect(transcript).toContain('output-error');
      }
      if (file === 'claude-cancelled.json') {
        expect(
          events.some(
            (e) =>
              e.kind === 'approval.resolved' &&
              e.payload.decision === 'approve',
          ),
        ).toBe(false);
        expect(
          events.find((e) => e.kind === 'tool.completed')?.payload.status,
        ).toBe('cancelled');
      }
      expect(transcript).toContain('native.unknown');
    },
  );
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
