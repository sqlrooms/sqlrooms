/** @jest-environment jsdom */
import {TransformStream} from 'node:stream/web';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {jest} from '@jest/globals';
import type {
  HarnessRun,
  HarnessRunEvent,
  HarnessConversationSnapshot,
} from '@sqlrooms/ai-config';
import type {HarnessRunClient, HarnessRunChatRuntime} from '../src/harnessRun';
jest.unstable_mockModule('../src/components/LocalAgentChatMessages', () => ({
  LocalAgentChatMessages: () => null,
}));
Object.assign(globalThis, {TransformStream});
const {HarnessRunChatRoot} = await import('../src/harnessRun');
const {useChatRuntime} = await import('../src/components/ChatRuntimeContext');
Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
const run: HarnessRun = {
  runId: 'run',
  conversationId: 'conversation',
  turnId: 'turn',
  principalId: 'owner',
  status: 'queued',
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
  eventId: `event-${seq}`,
  conversationId: 'conversation',
  runId: 'run',
  at: '2026-10-25T12:00:00Z',
  principalId: 'owner',
  kind,
  payload,
});
async function fixture() {
  let runtime: HarnessRunChatRuntime;
  let listener: (event: HarnessRunEvent) => void = () => {};
  const snapshot: HarnessConversationSnapshot = {
    conversationId: 'conversation',
    lastSeq: 0,
    historyAfterSeq: 0,
    historyHasMore: false,
    events: [],
    runs: [],
    pendingApprovals: [],
  };
  const client: HarnessRunClient = {
    snapshot: jest.fn(async () => snapshot),
    history: async () => [],
    subscribe: (_after, next) => {
      listener = next;
      return () => {};
    },
    startTurn: jest.fn(async () => run),
    sendInput: async () => {},
    cancel: async () => {},
    resolveApproval: async () => {},
    fetchBlob: async () => '',
  };
  function Probe() {
    const value = useChatRuntime();
    if (value.mode === 'harness-run') runtime = value;
    return null;
  }
  const element = document.createElement('div');
  const root = createRoot(element);
  await act(async () => {
    root.render(
      <HarnessRunChatRoot client={client} conversationId="conversation">
        <Probe />
      </HarnessRunChatRoot>,
    );
  });
  return {
    client,
    snapshot,
    get runtime() {
      return runtime!;
    },
    emit: (value: HarnessRunEvent) => listener(value),
    async close() {
      await act(async () => root.unmount());
    },
  };
}
it('a late start response cannot replace newer streamed terminal state', async () => {
  const f = await fixture();
  let resolve!: (run: HarnessRun) => void;
  f.client.startTurn = () =>
    new Promise((done) => {
      resolve = done;
    });
  try {
    await act(async () => {
      f.runtime.sendPrompt('Start');
    });
    await act(async () => {
      f.emit(
        event(1, 'run.status', {
          status: 'succeeded',
          run: {...run, status: 'succeeded'},
        }),
      );
    });
    await act(async () => {
      resolve(run);
    });
    expect(f.runtime.run?.status).toBe('succeeded');
  } finally {
    await f.close();
  }
});
it('queues during a run started by another client and submits after its terminal event', async () => {
  const f = await fixture();
  try {
    await act(async () =>
      f.emit(
        event(1, 'run.status', {
          status: 'running',
          run: {...run, status: 'running'},
        }),
      ),
    );
    await act(async () => f.runtime.sendPrompt('Follow up'));
    expect(f.client.startTurn).not.toHaveBeenCalled();
    expect(f.runtime.queued).toBe('Follow up');
    await act(async () =>
      f.emit(
        event(2, 'run.status', {
          status: 'succeeded',
          run: {...run, status: 'succeeded'},
        }),
      ),
    );
    expect(f.client.startTurn).toHaveBeenCalledTimes(1);
    expect(f.client.startTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conversation',
        text: 'Follow up',
      }),
    );
  } finally {
    await f.close();
  }
});
it('approval conflict and stale snapshot cannot resurrect a resolved card', async () => {
  const f = await fixture();
  const approval = {
    approvalId: 'approval',
    runId: 'run',
    callId: 'call',
    summary: 'Approve?',
    options: ['approve', 'deny'] as ('approve' | 'deny')[],
    decision: null,
    resolvedBy: null,
  };
  try {
    await act(async () => f.emit(event(1, 'approval.requested', approval)));
    f.snapshot.lastSeq = 1;
    f.snapshot.pendingApprovals = [approval];
    f.client.resolveApproval = async () => {
      f.emit(
        event(2, 'approval.resolved', {
          ...approval,
          decision: 'deny',
          resolvedBy: 'owner',
        }),
      );
      throw new Error('approval_conflict');
    };
    await act(async () => f.runtime.resolveApproval('approval', 'approve'));
    expect(f.runtime.pendingApprovals).toEqual([]);
    expect(f.runtime.error).toContain('approval_conflict');
  } finally {
    await f.close();
  }
});
