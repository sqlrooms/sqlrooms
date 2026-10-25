#!/usr/bin/env node
// Deterministic native protocol double. Live Codex verification is separate.
import {createInterface} from 'node:readline';
const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
let mode = '';
for await (const line of createInterface({input: process.stdin})) {
  const request = JSON.parse(line);
  if (request.method === 'initialize') send({id: request.id, result: {}});
  if (request.method === 'config/read')
    send({
      id: request.id,
      result: {
        config: {
          mcp_servers: {roomie: {enabled: true}},
          features: {plugins: false, apps: false},
        },
      },
    });
  if (request.method === 'thread/start')
    send({id: request.id, result: {thread: {id: 'scripted-native'}}});
  if (request.method === 'turn/start') {
    mode = request.params.input[0].text;
    if (mode.includes('approval'))
      send({
        id: 'approval-rpc',
        method: 'item/commandExecution/requestApproval',
        params: {itemId: 'shell', command: 'echo explicit owner approval'},
      });
    send({id: request.id, result: {turn: {id: 'turn'}}});
    if (mode.includes('hang') || mode.includes('approval')) continue;
    const secret = process.env.ROOMIE_RUN_TOKEN;
    send({
      method: 'item/commandExecution/outputDelta',
      params: {itemId: 'shell', delta: secret.slice(0, 10)},
    });
    send({
      method: 'item/agentMessage/delta',
      params: {itemId: 'message', delta: secret.slice(0, 10)},
    });
    setTimeout(() => {
      send({
        method: 'item/commandExecution/outputDelta',
        params: {itemId: 'shell', delta: secret.slice(10)},
      });
      send({
        method: 'item/completed',
        params: {
          item: {
            id: 'shell',
            type: 'commandExecution',
            command: 'test',
            aggregatedOutput: secret,
          },
        },
      });
      send({
        method: 'item/agentMessage/delta',
        params: {itemId: 'message', delta: secret.slice(10) + ' Hello'},
      });
      send({
        method: 'item/completed',
        params: {item: {id: 'message', type: 'agentMessage'}},
      });
      send({method: 'turn/completed', params: {turn: {status: 'completed'}}});
    }, 150);
  }
  if (request.id === 'approval-rpc' && request.result) {
    send({
      method: 'item/agentMessage/delta',
      params: {itemId: 'decision', delta: request.result.decision},
    });
    send({method: 'turn/completed', params: {turn: {status: 'completed'}}});
  }
}
