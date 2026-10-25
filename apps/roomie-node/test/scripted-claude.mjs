#!/usr/bin/env node
import {createInterface} from 'node:readline';
const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
let prompt = '';
function complete(error = false) {
  send({
    type: 'assistant',
    uuid: 'answer',
    message: {
      content: [
        {type: 'text', text: process.env.ROOMIE_RUN_TOKEN + ' Claude hello'},
      ],
    },
  });
  send({
    type: 'result',
    subtype: 'success',
    is_error: error,
    usage: {input_tokens: 12, output_tokens: 3},
  });
  process.exitCode = prompt.includes('bad exit') ? 1 : 0;
}
for await (const line of createInterface({input: process.stdin})) {
  const message = JSON.parse(line);
  if (message.type === 'control_request') {
    send({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: message.request_id,
        response: {commands: [{name: 'roomie:roomie'}]},
      },
    });
  } else if (message.type === 'user') {
    prompt = message.message.content;
    if (prompt.includes('oversized')) {
      process.stdout.write('x'.repeat(2100000));
      continue;
    }
    send({
      type: 'system',
      subtype: 'init',
      session_id: 'scripted-claude-session',
      claude_code_version: '2.1.310',
      mcp_servers: [{name: 'roomie', status: 'connected'}],
      tools: prompt.includes('unexpected tools')
        ? ['Bash']
        : ['Skill', 'mcp__roomie__search_commands'],
    });
    if (prompt.includes('wait forever')) continue;
    if (prompt.includes('approval')) {
      send({
        type: 'assistant',
        uuid: 'call',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'call-1',
              name:
                prompt.includes('receipt') || prompt.includes('command failure')
                  ? 'mcp__roomie__execute_command'
                  : 'mcp__roomie__search_commands',
              input: {query: 'list'},
            },
          ],
        },
      });
      send({
        type: 'control_request',
        request_id: 'permission-1',
        request: {
          subtype: 'can_use_tool',
          tool_name:
            prompt.includes('receipt') || prompt.includes('command failure')
              ? 'mcp__roomie__execute_command'
              : 'mcp__roomie__search_commands',
          tool_use_id: 'call-1',
          input: {query: 'list'},
        },
      });
      if (prompt.includes('native cancel'))
        send({type: 'control_cancel_request', request_id: 'permission-1'});
    } else complete(prompt.includes('api error'));
  } else if (message.type === 'control_response') {
    const allowed = message.response.response?.behavior === 'allow';
    const value = prompt.includes('command failure')
      ? {ok: false, message: 'Stale revision'}
      : prompt.includes('receipt')
        ? {
            ok: true,
            data: {
              receipt: {operationId: 'op-1', artifactId: 'doc-1', revision: 1},
            },
          }
        : {ok: true, data: {commands: []}};
    const content = JSON.stringify(value);
    send({
      type: 'user',
      uuid: 'result',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call-1',
            is_error: !allowed,
            content: allowed
              ? prompt.includes('text array')
                ? [{type: 'text', text: content}]
                : content
              : 'Owner denied',
          },
        ],
      },
    });
    complete();
  }
}
