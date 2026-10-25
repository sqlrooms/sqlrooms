import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClaudeRecording} from './normalize-claude-recording.mjs';
const frame = (direction, message) => ({
  at: '2026-10-25T15:00:00.000Z',
  direction,
  message,
});
const input = [
  frame('out', {
    type: 'system',
    subtype: 'init',
    session_id: 'native-session',
    secret: 'private-config',
  }),
  frame('in', {
    type: 'user',
    uuid: 'turn',
    message: {content: 'Synthetic prompt'},
  }),
];
const exit = frame('host', {type: 'exit', code: 0, signal: null});
const result = (is_error = false) =>
  frame('out', {
    type: 'result',
    subtype: 'success',
    is_error,
    usage: {output_tokens: 3, private_data: 'private-usage'},
  });
const request = frame('out', {
  type: 'control_request',
  request_id: 'approval',
  request: {
    subtype: 'can_use_tool',
    tool_name: 'mcp__roomie__query',
    tool_use_id: 'call',
    input: {private: 'private-input'},
  },
});
const tool = frame('out', {
  type: 'assistant',
  uuid: 'message',
  message: {
    content: [
      {
        type: 'tool_use',
        id: 'call',
        name: 'mcp__roomie__query',
        input: {private: 'private-input'},
      },
    ],
  },
});

test('Claude fixture normalization omits native secrets and does not duplicate streamed text', () => {
  const events = normalizeClaudeRecording([
    ...input,
    frame('out', {type: 'stream_event', event: {delta: {text: 'Hello'}}}),
    frame('out', {
      type: 'assistant',
      uuid: 'answer',
      message: {
        content: [
          {type: 'thinking', thinking: 'private-reasoning'},
          {type: 'text', text: 'Hello'},
        ],
      },
    }),
    tool,
    frame('out', {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call',
            content: '{"ok":true,"private":"private-output"}',
          },
        ],
      },
    }),
    result(),
    exit,
  ]);
  assert.equal(events.filter((e) => e.kind === 'message.text').length, 1);
  assert.equal(
    events.find((e) => e.kind === 'message.text').payload.text,
    'Hello',
  );
  assert.ok(!JSON.stringify(events).includes('private-'));
  assert.equal(events.at(-1).payload.status, 'succeeded');
});

test('Claude success subtype cannot hide an API error or unsuccessful process exit', () => {
  for (const records of [
    [...input, result(true), exit],
    [...input, result(), frame('host', {type: 'exit', code: 1})],
    [...input, exit],
  ])
    assert.equal(
      normalizeClaudeRecording(records).at(-1).payload.status,
      'failed',
    );
  assert.throws(
    () => normalizeClaudeRecording([...input, result()]),
    /process exit/,
  );
});

test('Claude cancellation invalidates pending permission without inventing owner approval or tool success', () => {
  const events = normalizeClaudeRecording([
    ...input,
    tool,
    request,
    frame('in', {
      type: 'control_request',
      request_id: 'cancel',
      request: {subtype: 'interrupt'},
    }),
    frame('out', {type: 'control_cancel_request', request_id: 'approval'}),
    frame('out', {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call',
            content: 'Interrupted',
            is_error: true,
          },
        ],
      },
    }),
    result(true),
    exit,
  ]);
  assert.equal(events.at(-1).payload.status, 'cancelled');
  assert.deepEqual(
    events
      .filter((e) => e.kind === 'approval.resolved')
      .map((e) => [e.payload.decision, e.payload.resolvedBy]),
    [['deny', 'recorder']],
  );
  assert.equal(
    events.find((e) => e.kind === 'tool.completed').payload.status,
    'cancelled',
  );
});

test('Claude permission decisions remain distinct from model-turn success', () => {
  for (const behavior of ['allow', 'deny']) {
    const events = normalizeClaudeRecording([
      ...input,
      tool,
      request,
      frame('in', {
        type: 'control_response',
        response: {request_id: 'approval', response: {behavior}},
      }),
      frame('out', {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call',
              content: behavior === 'allow' ? '{"ok":true}' : 'Denied',
              is_error: behavior === 'deny',
            },
          ],
        },
      }),
      result(),
      exit,
    ]);
    assert.equal(
      events.find((e) => e.kind === 'approval.resolved').payload.decision,
      behavior === 'allow' ? 'approve' : 'deny',
    );
    assert.equal(
      events.find((e) => e.kind === 'tool.completed').payload.status,
      behavior === 'allow' ? 'completed' : 'denied',
    );
    assert.equal(events.at(-1).payload.status, 'succeeded');
  }
});
