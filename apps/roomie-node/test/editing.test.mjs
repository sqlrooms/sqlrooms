import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';

test('browser and agent compete at one revision; retry and restart retain content and receipts', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-edits-'));
  let workspace = await openWorkspace({directory});
  let server = await startWorkspaceServer({workspace});
  t.after(async () => {
    await server.dispose();
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
  const ticket = await fetch(server.url + '/api/auth/ticket', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
  }).then((r) => r.json());
  const page = await fetch(server.url + '/api/auth/exchange', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ticket: new URL(ticket.url).hash.split('=')[1]}),
  }).then((r) => r.json());
  const request = async (body, auth = page.token) => {
    const response = await fetch(server.url + '/api/commands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify(body),
    });
    return {status: response.status, body: await response.json()};
  };
  const created = await workspace.mutate({
    commandId: 'block-document.create',
    operationId: 'create',
    principalId: 'owner',
    input: {blocks: [{id: 'intro', type: 'paragraph', text: 'original'}]},
  });
  const artifactId = created.artifactId;
  const edit = {
    commandId: 'block-document.set-content',
    input: {
      artifactId,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: {id: 'intro'},
            content: [{type: 'text', text: 'browser draft'}],
          },
        ],
      },
    },
    commit: {operationId: 'browser', artifactId, expectedRevision: 1},
  };
  assert.equal((await request(edit, 'bad')).status, 401);
  const [browser, agent] = await Promise.all([
    request(edit),
    workspace.mutate({
      commandId: 'block-document.update-block',
      operationId: 'agent',
      principalId: 'owner',
      artifactId,
      expectedRevision: 1,
      input: {
        artifactId,
        blockId: 'intro',
        block: {id: 'intro', type: 'paragraph', text: 'agent edit'},
      },
    }),
  ]);
  assert.equal(Number(browser.status === 200) + Number(!('code' in agent)), 1);
  const winner = browser.status === 200 ? 'browser draft' : 'agent edit';
  assert.equal(
    (await workspace.read('block-document.get', {artifactId})).data.blocks[0]
      .text[0].text,
    winner,
  );
  if (browser.status === 409)
    assert.equal(browser.body.details.currentRevision, 2);
  else assert.equal(agent.code, 'revision-conflict');
  const saved = await request({
    ...edit,
    commit: {...edit.commit, operationId: 'reconciled', expectedRevision: 2},
  });
  assert.equal(saved.status, 200);
  const retry = await request({
    ...edit,
    commit: {...edit.commit, operationId: 'reconciled', expectedRevision: 2},
  });
  assert.deepEqual(retry, saved);
  await server.dispose();
  await workspace.dispose();
  workspace = await openWorkspace({directory});
  server = await startWorkspaceServer({workspace});
  assert.equal(
    (await workspace.read('block-document.get', {artifactId})).revision,
    3,
  );
  const restarted = await workspace.mutate({
    ...edit.commit,
    operationId: 'reconciled',
    expectedRevision: 2,
    principalId: 'owner',
    commandId: edit.commandId,
    input: edit.input,
  });
  assert.deepEqual(restarted, saved.body.data.receipt);
});

test('exact editor content preserves code, blockquotes, task lists, nested lists and title across retry/restart', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-rich-editor-'));
  let workspace = await openWorkspace({directory});
  t.after(async () => {
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  const created = await workspace.mutate({
    commandId: 'block-document.create',
    operationId: 'create',
    principalId: 'owner',
  });
  const paragraph = (text) => ({
    type: 'paragraph',
    content: [{type: 'text', text}],
  });
  const content = {
    type: 'doc',
    content: [
      {
        type: 'codeBlock',
        attrs: {id: 'code', language: 'sql'},
        content: [{type: 'text', text: 'SELECT 1;'}],
      },
      {
        type: 'blockquote',
        attrs: {id: 'quote'},
        content: [paragraph('Quoted'), paragraph('Second paragraph')],
      },
      {
        type: 'taskList',
        attrs: {id: 'tasks'},
        content: [
          {
            type: 'taskItem',
            attrs: {checked: true},
            content: [paragraph('Done')],
          },
          {
            type: 'taskItem',
            attrs: {checked: false},
            content: [paragraph('Pending')],
          },
        ],
      },
      {
        type: 'bulletList',
        attrs: {id: 'nested'},
        content: [
          {
            type: 'listItem',
            content: [
              paragraph('Outer'),
              {
                type: 'bulletList',
                content: [{type: 'listItem', content: [paragraph('Inner')]}],
              },
            ],
          },
        ],
      },
    ],
  };
  const request = {
    commandId: 'block-document.set-content',
    operationId: 'rich',
    principalId: 'owner',
    artifactId: created.artifactId,
    expectedRevision: 1,
    input: {artifactId: created.artifactId, content, title: 'Edited title'},
  };
  const receipt = await workspace.mutate(request);
  assert.equal(receipt.revision, 2);
  assert.deepEqual(
    (await workspace.snapshot()).content.blockDocuments.artifacts[
      created.artifactId
    ].content,
    content,
  );
  await workspace.dispose();
  workspace = await openWorkspace({directory});
  assert.deepEqual(await workspace.mutate(request), receipt);
  const snapshot = await workspace.snapshot();
  assert.deepEqual(
    snapshot.content.blockDocuments.artifacts[created.artifactId].content,
    content,
  );
  assert.equal(
    snapshot.content.artifacts.artifactsById[created.artifactId].title,
    'Edited title',
  );
});
