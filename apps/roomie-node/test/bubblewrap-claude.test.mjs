import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';

test(
  'real Bubblewrap Claude commits the shared command after explicit owner approval',
  {skip: !process.env.ROOMIE_BWRAP_RUNTIME, timeout: 60000},
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'rc-'));
    let called = false;
    const model = createServer(async (request, response) => {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      if (request.url.includes('count_tokens')) {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({input_tokens: 1}));
        return;
      }
      const body = JSON.parse(raw || '{}');
      if (!request.url.startsWith('/v1/messages')) {
        response.end('{}');
        return;
      }
      const tool = body.tools?.find(
        (tool) => tool.name === 'mcp__roomie__execute_command',
      );
      const content =
        !called && tool
          ? [
              {
                type: 'tool_use',
                id: 'tool_fixture',
                name: tool.name,
                input: {
                  commandId: 'block-document.create',
                  input: {title: 'Real Bubblewrap Claude'},
                  commit: {operationId: 'bwrap-claude-create'},
                },
              },
            ]
          : [{type: 'text', text: 'Shared command completed.'}];
      if (tool) called = true;
      const stop_reason =
        content[0].type === 'tool_use' ? 'tool_use' : 'end_turn';
      const message = {
        id: 'msg_fixture',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content,
        stop_reason,
        stop_sequence: null,
        usage: {input_tokens: 1, output_tokens: 1},
      };
      if (!body.stream) {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(message));
        return;
      }
      response.setHeader('content-type', 'text/event-stream');
      const emit = (type, data) =>
        response.write(
          `event: ${type}\ndata: ${JSON.stringify({type, ...data})}\n\n`,
        );
      emit('message_start', {
        message: {...message, content: [], stop_reason: null},
      });
      const block = content[0];
      emit('content_block_start', {
        index: 0,
        content_block:
          block.type === 'tool_use'
            ? {...block, input: {}}
            : {type: 'text', text: ''},
      });
      emit('content_block_delta', {
        index: 0,
        delta:
          block.type === 'tool_use'
            ? {
                type: 'input_json_delta',
                partial_json: JSON.stringify(block.input),
              }
            : {type: 'text_delta', text: block.text},
      });
      emit('content_block_stop', {index: 0});
      emit('message_delta', {
        delta: {stop_reason, stop_sequence: null},
        usage: {output_tokens: 1},
      });
      emit('message_stop', {});
      response.end();
    });
    await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${model.address().port}`;
    const workspace = await openWorkspace({directory: join(root, 'workspace')});
    const original = workspace.runs.start;
    workspace.runs.start = (...args) => {
      const result = original(...args);
      if (result.created) {
        const cwd = join(workspace.directory, 'sessions', result.run.runId);
        mkdirSync(cwd, {recursive: true});
        writeFileSync(
          join(cwd, 'provider.json'),
          JSON.stringify({url: origin}),
        );
      }
      return result;
    };
    const server = await startWorkspaceServer({
      workspace,
      harness: {
        adapter: 'claude',
        isolation: {
          backend: 'bubblewrap',
          runtimeDirectory: process.env.ROOMIE_BWRAP_RUNTIME,
          modelOrigins: [origin],
        },
        executable: '/runtime/real-claude.mjs',
        deadlineMs: 30000,
      },
    });
    t.after(async () => {
      await server.dispose();
      await workspace.dispose();
      model.closeAllConnections();
      await new Promise((r) => model.close(r));
      await rm(root, {recursive: true, force: true});
    });
    const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
    const post = async (path, body) => {
      const res = await fetch(server.url + path, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 200);
      return res.json();
    };
    const run = await post('/api/runs/start', {
      idempotencyKey: 'claude-native',
      text: 'Create the report through the shared command.',
    });
    let approvals = 0;
    for (let n = 0; n < 1500; n++) {
      for (const approval of workspace.runs.pending()) {
        assert.equal(workspace.runs.get(run.runId).status, 'awaiting-approval');
        assert.equal(
          Object.keys((await workspace.snapshot()).revisions).length,
          0,
        );
        await post('/api/approvals/resolve', {
          approvalId: approval.approvalId,
          decision: 'approve',
        });
        approvals++;
      }
      if (
        ['succeeded', 'failed', 'interrupted'].includes(
          workspace.runs.get(run.runId).status,
        )
      )
        break;
      await delay(20);
    }
    assert.equal(
      workspace.runs.get(run.runId).status,
      'succeeded',
      JSON.stringify(workspace.runs.events(0)),
    );
    assert.ok(called);
    assert.ok(approvals > 0);
    const event = workspace.runs
      .events(0)
      .find(
        (e) =>
          e.kind === 'tool.completed' &&
          e.payload.operationId === 'bwrap-claude-create',
      );
    assert.ok(event, JSON.stringify(workspace.runs.events(0)));
    assert.equal(
      (await workspace.snapshot()).revisions[
        event.payload.artifactRefs[0].artifactId
      ],
      1,
    );
  },
);
