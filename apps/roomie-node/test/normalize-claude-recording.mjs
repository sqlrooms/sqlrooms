// Offline fixture conversion only: this is not a live host adapter.

/** Convert private, timestamped stdio captures to allowlisted v1 replay events. */
export function normalizeClaudeRecording(records) {
  const init = records.find(
    ({direction, message}) =>
      direction === 'out' &&
      message.type === 'system' &&
      message.subtype === 'init',
  )?.message;
  const user = records.find(
    ({direction, message}) => direction === 'in' && message.type === 'user',
  );
  const exit = records.at(-1);
  if (!init?.session_id || !user || exit?.message.type !== 'exit')
    throw new Error(
      'A native init, user prompt, and observed process exit are required.',
    );
  const run = {
    runId: init.session_id,
    conversationId: init.session_id,
    turnId: user.message.uuid,
    principalId: 'fixture-operator',
    status: 'queued',
    nativeSessionId: init.session_id,
    // The recorder injects the skill text, not a host-managed skill package.
    skillHash: 'offline-recording-system-prompt',
    deadlineAt: new Date(Date.parse(records[0].at) + 240000).toISOString(),
    capabilities: {
      liveInput: false,
      continueSession: false,
      approvalRecovery: false,
      cancelTurn: true,
      reasoningSummary: false,
      planUpdates: false,
      usage: true,
    },
  };
  const events = [];
  const calls = new Map();
  const approvals = new Map();
  const denied = new Set();
  const cancelled = new Set();
  let result;
  let interrupted = false;
  const add = (record, kind, payload) => {
    const seq = events.length + 1;
    const nativeEventId = record.message.uuid ?? record.message.request_id;
    events.push({
      schemaVersion: 1,
      seq,
      eventId: `${run.runId}:${seq}`,
      conversationId: run.conversationId,
      runId: run.runId,
      turnId: run.turnId,
      at: record.at,
      principalId: run.principalId,
      ...(nativeEventId ? {nativeEventId} : {}),
      kind,
      payload,
    });
  };
  const status = (record, value, reason) => {
    run.status = value;
    add(record, 'run.status', {
      status: value,
      run: {...run},
      ...(reason ? {reason} : {}),
    });
  };
  const resolve = (record, approvalId, decision, resolvedBy, reason) => {
    const approval = approvals.get(approvalId);
    if (!approval) return;
    approvals.delete(approvalId);
    if (decision === 'deny' && resolvedBy === 'fixture-operator')
      denied.add(approval.callId);
    if (resolvedBy === 'recorder') cancelled.add(approval.callId);
    add(record, 'approval.resolved', {
      ...approval,
      decision,
      resolvedBy,
      ...(reason ? {reason} : {}),
    });
  };
  status(records[0], 'queued');
  status(records[0], 'running');
  for (const record of records) {
    const {direction, message} = record;
    if (direction === 'in' && message.type === 'user') {
      add(record, 'turn.started', {origin: 'user'});
      add(record, 'message.user', {
        text: message.message.content,
        attachments: [],
      });
    }
    if (
      direction === 'in' &&
      message.type === 'control_request' &&
      message.request.subtype === 'interrupt'
    )
      interrupted = true;
    if (direction === 'in' && message.type === 'control_response') {
      const response = message.response.response;
      if (response && approvals.has(message.response.request_id)) {
        resolve(
          record,
          message.response.request_id,
          response.behavior === 'allow' ? 'approve' : 'deny',
          'fixture-operator',
        );
        if (!approvals.size) status(record, 'running');
      }
    }
    if (direction !== 'out') continue;
    // Completed blocks are authoritative. Partial stream_event frames are omitted
    // so text is not counted once as deltas and again as completed messages.
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          const messageId = message.uuid;
          add(record, 'message.text', {messageId, text: block.text});
          add(record, 'message.completed', {messageId, status: 'completed'});
        }
        if (block.type === 'tool_use') {
          const call = {
            callId: block.id,
            name: block.name,
            toolClass:
              block.name === 'mcp__roomie__execute_command'
                ? 'roomie-command'
                : 'mcp',
          };
          calls.set(block.id, call);
          add(record, 'tool.started', call);
        }
      }
    }
    if (message.type === 'user' && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        if (block.type !== 'tool_result') continue;
        const call = calls.get(block.tool_use_id);
        if (!call) throw new Error('Tool result without recorded tool call.');
        let data;
        try {
          data = JSON.parse(block.content);
        } catch {
          /* Native denial text is not JSON. */
        }
        const receipt = data?.data?.receipt;
        add(record, 'tool.completed', {
          ...call,
          status: cancelled.has(call.callId)
            ? 'cancelled'
            : denied.has(call.callId)
              ? 'denied'
              : block.is_error || data?.ok === false
                ? 'failed'
                : 'completed',
          ...(receipt
            ? {
                operationId: receipt.operationId,
                artifactRefs: [{artifactId: receipt.artifactId}],
                result: {
                  operationId: receipt.operationId,
                  artifactId: receipt.artifactId,
                  revision: receipt.revision,
                },
              }
            : {}),
        });
        calls.delete(call.callId);
      }
    }
    if (
      message.type === 'control_request' &&
      message.request.subtype === 'can_use_tool'
    ) {
      const approval = {
        approvalId: message.request_id,
        runId: run.runId,
        callId: message.request.tool_use_id,
        summary: `Allow ${message.request.tool_name}?`,
        options: ['approve', 'deny'],
        decision: null,
        resolvedBy: null,
      };
      approvals.set(approval.approvalId, approval);
      add(record, 'approval.requested', approval);
      status(record, 'awaiting-approval');
    }
    if (message.type === 'control_cancel_request')
      resolve(
        record,
        message.request_id,
        'deny',
        'recorder',
        'Native request cancelled; no owner approval was granted.',
      );
    if (
      message.type === 'command_lifecycle' ||
      (message.type === 'system' && message.subtype === 'init')
    )
      add(record, 'native.unknown', {
        nativeType: message.type === 'system' ? 'system.init' : message.type,
        summary:
          'Native lifecycle notification; configuration and raw payload omitted.',
      });
    if (message.type === 'result') {
      result = message;
      const usage = {};
      for (const key of [
        'input_tokens',
        'output_tokens',
        'cache_read_input_tokens',
        'cache_creation_input_tokens',
      ])
        if (typeof message.usage?.[key] === 'number')
          usage[key] = message.usage[key];
      add(record, 'usage', {usage});
    }
  }
  const outcome = interrupted
    ? 'cancelled'
    : result?.is_error === false &&
        result.subtype === 'success' &&
        exit.message.code === 0
      ? 'succeeded'
      : 'failed';
  for (const id of approvals.keys())
    resolve(
      exit,
      id,
      'deny',
      'recorder',
      'Process exited; native request is no longer live.',
    );
  for (const call of calls.values())
    add(exit, 'tool.completed', {
      ...call,
      status: outcome === 'cancelled' ? 'cancelled' : 'interrupted',
    });
  add(exit, 'turn.completed', {outcome});
  status(
    exit,
    outcome,
    interrupted
      ? 'Recording operator cancelled the native turn before granting approval.'
      : undefined,
  );
  return events;
}
