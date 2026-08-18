import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {createStore} from 'zustand';
import {type AiSliceState, createAiSlice} from '../src/AiSlice';
import {getChatRequestErrorMessage} from '../src/chatTurns';
import {ChatTimeoutError} from '../src/timeouts';

describe('AiSlice run timeout', () => {
  afterEach(() => jest.useRealTimers());

  it('is opt-in and records a timeout instead of a manual-cancel message', async () => {
    jest.useFakeTimers();
    const sendMessage = jest.fn();
    const stop = jest.fn();
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({
        tools: {} as any,
        getInstructions: () => 'test',
        timeouts: {runMs: 1_000},
      })(set, get, api),
    );
    store.getState().ai.createSession();
    const sessionId = store.getState().ai.getCurrentSession()!.id;
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-query',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: {sql: 'select 1'},
          },
          {
            type: 'tool-deleteItem',
            toolCallId: 'tool-approval',
            state: 'approval-requested',
            input: {id: 'item-1'},
            approval: {id: 'approval-1'},
          },
        ],
      },
    ];
    store.getState().ai.setSessionUiMessages(sessionId, messages);
    store.getState().ai.setPrompt(sessionId, 'hello');
    store.getState().ai.setChatSendMessage(sessionId, sendMessage);
    store.getState().ai.setChatStop(sessionId, stop);

    await store.getState().ai.startAnalysis(sessionId);
    await jest.advanceTimersByTimeAsync(1_000);

    const controller = store.getState().ai.getAbortController(sessionId);
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello'});
    expect(stop).toHaveBeenCalledTimes(1);
    expect(controller?.signal.reason).toBeInstanceOf(ChatTimeoutError);
    expect(store.getState().ai.getIsRunning(sessionId)).toBe(false);

    // The run timeout persists the failure even if useChat is paused on a
    // client tool and never invokes a transport callback.
    let saved = store.getState().ai.getCurrentSession()!
      .uiMessages as UIMessage[];
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[1]).toMatchObject({
      state: 'output-error',
      errorText: 'Chat run timed out after 1s',
    });

    // A later callback remains consistent with the persisted timeout reason.
    store.getState().ai.onChatFinish({sessionId, messages});

    saved = store.getState().ai.getCurrentSession()!.uiMessages as UIMessage[];
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: 'Chat run timed out after 1s',
    });
    expect(saved[1]?.parts[1]).toMatchObject({
      state: 'output-error',
      errorText: 'Chat run timed out after 1s',
    });
  });

  it('does not schedule a run timeout when none is configured', async () => {
    jest.useFakeTimers();
    const stop = jest.fn();
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({tools: {} as any, getInstructions: () => 'test'})(
        set,
        get,
        api,
      ),
    );
    store.getState().ai.createSession();
    const sessionId = store.getState().ai.getCurrentSession()!.id;
    store.getState().ai.setChatSendMessage(sessionId, jest.fn());
    store.getState().ai.setChatStop(sessionId, stop);

    await store.getState().ai.startAnalysis(sessionId);
    await jest.advanceTimersByTimeAsync(24 * 60 * 60_000);

    expect(stop).not.toHaveBeenCalled();
    expect(
      store.getState().ai.getAbortController(sessionId)?.signal.aborted,
    ).toBe(false);
  });

  it('persists an idle timeout before a background chat can unmount', () => {
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({tools: {} as any, getInstructions: () => 'test'})(
        set,
        get,
        api,
      ),
    );
    store.getState().ai.createSession();
    const session = store.getState().ai.getCurrentSession()!;
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-query',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: {sql: 'select 1'},
          },
        ],
      },
    ];
    store.getState().ai.setIsRunning(session.id, true);
    store.getState().ai.setToolTiming('tool-1', {
      startedAt: 100,
      completedAt: 200,
    });
    store.getState().ai.updateAgentProgress('tool-1', [
      {
        toolCallId: 'nested-query',
        toolName: 'query',
        state: 'success',
        output: {rows: 1},
      },
    ]);

    store
      .getState()
      .ai.persistTimedOutSession(
        session.id,
        messages,
        'No model or tool progress received for 2s',
      );

    const savedSession = store.getState().ai.getCurrentSession()!;
    const saved = savedSession.uiMessages as UIMessage[];
    expect(savedSession.isRunning).toBe(false);
    expect(savedSession.messagesRevision).toBe(
      (session.messagesRevision || 0) + 1,
    );
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'No model or tool progress received for 2s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: 'No model or tool progress received for 2s',
    });
    expect(saved[1]?.metadata).toMatchObject({
      toolTimings: {
        'tool-1': {startedAt: 100, completedAt: 200},
      },
    });
    expect(savedSession.agentProgress).toEqual({
      'tool-1': [
        {
          toolCallId: 'nested-query',
          toolName: 'query',
          state: 'success',
          output: {rows: 1},
        },
      ],
    });
  });

  it('fails and releases reachable sub-agent approvals on timeout', () => {
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({tools: {} as any, getInstructions: () => 'test'})(
        set,
        get,
        api,
      ),
    );
    store.getState().ai.createSession();
    const session = store.getState().ai.getCurrentSession()!;
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-agent',
            toolCallId: 'session-root',
            state: 'input-available',
            input: {},
          },
        ],
      },
    ];
    const resolve = jest.fn();
    const otherResolve = jest.fn();
    store.getState().ai.updateAgentProgress('session-root', [
      {
        toolCallId: 'nested-approval',
        toolName: 'deleteItem',
        state: 'approval-requested',
        approvalId: 'approval-1',
      },
      {
        toolCallId: 'nested-query',
        toolName: 'query',
        state: 'pending',
      },
    ]);
    store.getState().ai.updateAgentProgress('other-session', [
      {
        toolCallId: 'other-approval',
        toolName: 'deleteItem',
        state: 'approval-requested',
        approvalId: 'approval-other',
      },
    ]);
    store.getState().ai.requestSubAgentApproval({
      toolCallId: 'nested-approval',
      approvalId: 'approval-1',
      toolName: 'deleteItem',
      input: {},
      resolve,
    });
    store.getState().ai.requestSubAgentApproval({
      toolCallId: 'other-approval',
      approvalId: 'approval-other',
      toolName: 'deleteItem',
      input: {},
      resolve: otherResolve,
    });

    store
      .getState()
      .ai.persistTimedOutSession(
        session.id,
        messages,
        'Chat run timed out after 1s',
      );

    const state = store.getState();
    const savedSession = state.ai.getCurrentSession()!;
    expect(resolve).toHaveBeenCalledWith(false);
    expect(otherResolve).not.toHaveBeenCalled();
    expect(state.ai.pendingSubAgentApprovals).toEqual({
      'approval-other': expect.objectContaining({
        toolCallId: 'other-approval',
      }),
    });
    expect(state.ai.agentProgress['session-root']).toEqual([
      expect.objectContaining({
        toolCallId: 'nested-approval',
        state: 'error',
        errorText: 'Chat run timed out after 1s',
        approvalId: undefined,
        completedAt: expect.any(Number),
      }),
      expect.objectContaining({
        toolCallId: 'nested-query',
        state: 'error',
        errorText: 'Chat run timed out after 1s',
        completedAt: expect.any(Number),
      }),
    ]);
    expect(state.ai.agentProgress['other-session']).toEqual([
      expect.objectContaining({
        toolCallId: 'other-approval',
        state: 'approval-requested',
      }),
    ]);
    expect(savedSession.agentProgress).toEqual({
      'session-root': state.ai.agentProgress['session-root'],
    });
  });

  it('preserves the timeout reason when onChatError completes a pending tool', () => {
    const store = createStore<AiSliceState>((set, get, api) =>
      createAiSlice({tools: {} as any, getInstructions: () => 'test'})(
        set,
        get,
        api,
      ),
    );
    store.getState().ai.createSession();
    const sessionId = store.getState().ai.getCurrentSession()!.id;
    const controller = new AbortController();
    controller.abort(
      new ChatTimeoutError(
        'idle-stream',
        2_000,
        'No model or tool progress received for 2s',
      ),
    );
    store.getState().ai.setAbortController(sessionId, controller);
    store.getState().ai.updateAgentProgress('tool-1', [
      {
        toolCallId: 'nested-query',
        toolName: 'query',
        state: 'error',
        errorText: 'Tool call cancelled by user',
      },
    ]);

    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-query',
            toolCallId: 'tool-1',
            state: 'input-available',
            input: {sql: 'select 1'},
          },
        ],
      },
    ];

    store
      .getState()
      .ai.onChatError(
        sessionId,
        new Error('The operation was aborted'),
        messages,
      );

    const saved = store.getState().ai.getCurrentSession()!
      .uiMessages as UIMessage[];
    expect(getChatRequestErrorMessage(saved[0])).toEqual({
      error: 'No model or tool progress received for 2s',
    });
    expect(saved[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      errorText: 'No model or tool progress received for 2s',
    });
    const state = store.getState();
    expect(state.ai.agentProgress['tool-1']).toEqual([
      expect.objectContaining({
        toolCallId: 'nested-query',
        state: 'error',
        errorText: 'No model or tool progress received for 2s',
      }),
    ]);
    expect(state.ai.getCurrentSession()?.agentProgress).toEqual({
      'tool-1': state.ai.agentProgress['tool-1'],
    });
  });
});
