/** @jest-environment jsdom */
import {TransformStream} from 'node:stream/web';
import {readFileSync} from 'node:fs';
import {serialize, deserialize} from 'node:v8';
import {createHarnessReplayClient} from '../src/harnessReplayClient';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {jest} from '@jest/globals';
import {
  HarnessRun,
  type HarnessRunEvent,
  type HarnessConversationSnapshot,
} from '@sqlrooms/ai-config';
import type {HarnessRunClient, HarnessRunChatRuntime} from '../src/harnessRun';
jest.unstable_mockModule('../src/components/LocalAgentChatMessages', () => ({
  LocalAgentChatMessages: ({
    renderToolDetails,
  }: {
    renderToolDetails?: (call: {
      toolCallId: string;
      output: unknown;
    }) => React.ReactNode;
  }) => {
    const runtime = useChatRuntime();
    return runtime.mode === 'harness-run' ? (
      <>
        {runtime.messages.flatMap((message) =>
          message.parts.map((part) =>
            part.type === 'dynamic-tool' &&
            part.state === 'output-available' ? (
              <React.Fragment key={part.toolCallId}>
                {renderToolDetails?.({
                  toolCallId: part.toolCallId,
                  output: part.output,
                })}
              </React.Fragment>
            ) : null,
          ),
        )}
      </>
    ) : null;
  },
}));
// JSDOM omits structuredClone; the fixture client needs the browser's clone API.
Object.assign(globalThis, {
  TransformStream,
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  structuredClone: (value: unknown) => deserialize(serialize(value)),
});
const {
  HarnessRunChatRoot,
  HarnessRunMessages,
  HarnessRunDetails,
  HarnessRunControls,
} = await import('../src/harnessRun');
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
        <HarnessRunControls />
        <HarnessRunMessages />
      </HarnessRunChatRoot>,
    );
  });
  return {
    client,
    element,
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

it('opens the real Claude recording artifact through the shared details renderer', async () => {
  const events: HarnessRunEvent[] = JSON.parse(
    readFileSync(
      new URL(
        '../../ai-config/fixtures/harness-v1/claude-roomie-tools.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const recordedRun = HarnessRun.parse(events.at(-1)!.payload.run);
  const client = createHarnessReplayClient({
    conversationId: recordedRun.conversationId,
    events,
    runs: [recordedRun],
    lastSeq: events.at(-1)!.seq,
    historyAfterSeq: 0,
    historyHasMore: false,
    pendingApprovals: [],
  });
  const onArtifact = jest.fn();
  const element = document.createElement('div');
  const root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <HarnessRunChatRoot
          client={client}
          conversationId={recordedRun.conversationId}
        >
          <HarnessRunMessages onArtifact={onArtifact} />
          <HarnessRunDetails />
        </HarnessRunChatRoot>,
      ),
    );
    const button = [...element.querySelectorAll('button')].find(
      (value) => value.textContent === 'Open document awmqfvy17nl7xx7osenvlrtf',
    );
    expect(button).toBeDefined();
    await act(async () => button!.click());
    expect(onArtifact).toHaveBeenCalledWith('awmqfvy17nl7xx7osenvlrtf');
  } finally {
    await act(async () => root.unmount());
  }
});

it('uses the shared composer to queue during a run without replacing a queued turn', async () => {
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
    await act(async () => f.runtime.setPrompt('Follow up'));
    const button = [...f.element.querySelectorAll('button')].find(
      (b) => b.textContent === 'Queue next turn',
    )!;
    expect(button.disabled).toBe(false);
    expect(f.element.querySelector('textarea')?.disabled).toBe(false);
    await act(async () => button.click());
    expect(f.runtime.queued).toBe('Follow up');
    await act(async () => f.runtime.sendPrompt('Do not replace'));
    expect(f.runtime.queued).toBe('Follow up');
    expect(f.element.textContent).toContain('Stop');
  } finally {
    await f.close();
  }
});

it.each([{}, 'invalid', [null, {}, {artifactId: 3}]])(
  'ignores malformed untrusted artifact references: %j',
  async (artifactRefs) => {
    const f = await fixture();
    try {
      await act(async () =>
        f.emit(
          event(1, 'tool.completed', {
            callId: 'bad',
            status: 'succeeded',
            artifactRefs,
          }),
        ),
      );
      expect(f.element.textContent).not.toContain('Open document');
    } finally {
      await f.close();
    }
  },
);

it('stop clears a local queued turn before cancellation publishes terminal state', async () => {
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
    await act(async () => f.runtime.sendPrompt('Must not start after Stop'));
    f.client.cancel = async () => {
      f.emit(
        event(2, 'run.status', {
          status: 'cancelled',
          run: {...run, status: 'cancelled'},
        }),
      );
    };
    await act(async () => f.runtime.stop());
    expect(f.runtime.queued).toBe('');
    expect(f.client.startTurn).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
});
