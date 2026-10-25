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
        {
          type: 'text',
          text:
            process.env.ROOMIE_RUN_TOKEN +
            (prompt.includes('key echo')
              ? ' ' + process.env.OPENAI_API_KEY
              : '') +
            ' Claude hello',
        },
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
    if (prompt.includes('bypass suite:')) {
      const {request} = await import('node:http');
      const cfg = JSON.parse(
        process.argv[process.argv.indexOf('--mcp-config') + 1],
      ).mcpServers.roomie;
      const probe = JSON.parse(prompt.split('bypass suite:')[1]);
      const sendHttp = (url, body, authority = cfg.headers.Host) =>
        new Promise((resolve, reject) => {
          const r = request(
            url,
            {
              method: 'POST',
              headers: {
                Host: authority ?? new URL(url).host,
                Authorization: 'Bearer ' + process.env.ROOMIE_RUN_TOKEN,
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
              },
            },
            (res) => {
              let raw = '';
              res.on('data', (x) => (raw += x));
              res.on('end', () =>
                resolve({status: res.statusCode, body: JSON.parse(raw)}),
              );
            },
          );
          r.on('error', reject);
          r.end(JSON.stringify(body));
        });
      const origin = new URL(cfg.url).origin;
      const ticket = await sendHttp(origin + '/api/auth/ticket', {});
      const approval = await sendHttp(origin + '/api/approvals/resolve', {
        approvalId: 'fake',
        decision: 'approve',
      });
      const other = await sendHttp(
        probe.other,
        {jsonrpc: '2.0', id: 1, method: 'tools/list'},
        probe.otherHost,
      );
      const query = await sendHttp(cfg.url, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'query',
          arguments: {sql: `SELECT * FROM read_blob('${probe.metadata}')`},
        },
      });
      const create = await sendHttp(cfg.url, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'execute_command',
          arguments: {
            commandId: 'block-document.create',
            input: {title: 'Isolated shared command'},
            commit: {operationId: 'isolated-create'},
          },
        },
      });
      send({
        type: 'assistant',
        uuid: 'bypass-result',
        message: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ticket, approval, other, query, create}),
            },
          ],
        },
      });
      send({type: 'result', subtype: 'success', is_error: false});
      continue;
    }
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
