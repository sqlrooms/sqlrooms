import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
import {prepareIsolatedHarness} from '../dist-test/bridge.mjs';
import {http} from './http.mjs';
const publicOrigin = 'https://private-roomie.test';
const headers = {
  Host: 'private-roomie.test',
  Origin: publicOrigin,
  'Content-Type': 'application/json',
};
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'rg-'));
  const workspace = await openWorkspace({directory});
  let server = await startWorkspaceServer({
    workspace,
    publicOrigin,
    trustedGateway: {port: 0},
  });
  t.after(async () => {
    await server.dispose();
    await workspace.dispose();
    await rm(directory, {recursive: true, force: true});
  });
  return {
    directory,
    workspace,
    get server() {
      return server;
    },
    async restart() {
      await server.dispose();
      server = await startWorkspaceServer({
        workspace,
        publicOrigin,
        trustedGateway: {port: 0},
      });
    },
  };
}

test('trusted gateway issues limited browser sessions only on its dedicated ingress', async (t) => {
  const f = await fixture(t);
  const post = (url, overrides = {}) =>
    http(url + '/api/auth/gateway', {headers, body: {}, ...overrides});
  assert.equal(
    (
      await post(f.server.url, {
        headers: {
          ...headers,
          'X-Forwarded-Host': 'private-roomie.test',
          'X-Forwarded-Proto': 'https',
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (await http(f.server.url + '/auth.json', {method: 'GET', headers})).body
      .browserAuth,
    undefined,
  );
  assert.equal(
    (await http(f.server.gatewayUrl + '/auth.json', {method: 'GET', headers}))
      .body.browserAuth,
    'trusted-gateway',
  );
  for (const bad of [
    {Host: headers.Host, 'Content-Type': 'application/json'},
    {...headers, Origin: 'https://attacker.test'},
    {...headers, Origin: 'null'},
    {...headers, Host: new URL(f.server.url).host},
    {...headers, 'Content-Type': 'text/plain'},
    {...headers, 'Sec-Fetch-Site': 'cross-site'},
  ])
    assert.equal((await post(f.server.gatewayUrl, {headers: bad})).status, 403);
  assert.equal(
    (await post(f.server.gatewayUrl, {method: 'GET', body: undefined})).status,
    403,
  );
  assert.equal(
    (await http(f.server.gatewayUrl + '/api/content', {method: 'GET', headers}))
      .status,
    401,
  );
  const {body: page, status} = await post(f.server.gatewayUrl);
  assert.equal(status, 200);
  const auth = {...headers, 'X-SQLRooms-Token': page.token};
  assert.equal(
    (await http(f.server.gatewayUrl + '/api/auth/ticket', {headers: auth}))
      .status,
    403,
  );
  assert.equal(
    (await http(f.server.gatewayUrl + '/mcp', {headers: auth, body: {}}))
      .status,
    403,
  );
  const created = await http(f.server.gatewayUrl + '/api/commands', {
    headers: auth,
    body: {
      commandId: 'block-document.create',
      input: {title: 'Gateway report'},
      commit: {operationId: 'gateway-create'},
    },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.ok, true);
  const id = created.body.data.receipt.artifactId;
  assert.equal(
    (
      await http(f.server.gatewayUrl + '/api/content', {
        method: 'GET',
        headers: auth,
      })
    ).body.revisions[id],
    1,
  );
  await f.restart();
  assert.equal(
    (
      await http(f.server.gatewayUrl + '/api/content', {
        method: 'GET',
        headers: auth,
      })
    ).status,
    401,
  );
  const fresh = await post(f.server.gatewayUrl);
  assert.notEqual(fresh.body.binding, page.binding);
  const content = await http(f.server.gatewayUrl + '/api/content', {
    method: 'GET',
    headers: {...headers, 'X-SQLRooms-Token': fresh.body.token},
  });
  assert.equal(content.body.revisions[id], 1);
  const {token} = JSON.parse(await readFile(f.server.credentialPath, 'utf8'));
  assert.equal(
    (
      await http(f.server.url + '/api/auth/ticket', {
        headers: {Authorization: 'Bearer ' + token},
      })
    ).status,
    200,
  );
});

test('trusted gateway refuses missing HTTPS and harnesses that can reach host listeners', async (t) => {
  const f = await fixture(t);
  for (const options of [
    {},
    {publicOrigin, harness: {trustedLocal: true}},
    {
      publicOrigin,
      harness: {
        isolation: {
          backend: 'bubblewrap',
          runtimeDirectory: '/unused',
          modelOrigins: [publicOrigin],
        },
      },
    },
    {publicOrigin, harness: {isolation: {image: 'sha256:' + 'a'.repeat(64)}}},
  ])
    await assert.rejects(
      startWorkspaceServer({
        workspace: f.workspace,
        trustedGateway: {port: 0},
        ...options,
      }),
      /Trusted gateway requires/,
    );
});

test(
  'Bubblewrap cannot reach trusted gateway sign-in directly or through its MCP/model broker',
  {skip: !process.env.ROOMIE_BWRAP_RUNTIME},
  async (t) => {
    const f = await fixture(t);
    const cwd = join(f.directory, 'run');
    await mkdir(cwd);
    const boundary = await prepareIsolatedHarness({
      isolation: {
        backend: 'bubblewrap',
        runtimeDirectory: process.env.ROOMIE_BWRAP_RUNTIME,
      },
      workspaceDirectory: f.directory,
      cwd,
      mcpUrl: f.server.mcpUrl,
      token: 'agent-scoped-only',
      deadlineMs: 10000,
    });
    t.after(() => boundary.dispose());
    const child = boundary.spawn('node', [
      '-e',
      `
    const net=require('node:net');
    const probe=path=>new Promise((resolve,reject)=>{const s=net.connect({host:'127.0.0.1',port:43100});let data='';s.on('error',reject);s.on('connect',()=>s.write('POST '+path+' HTTP/1.1\\r\\nHost: private-roomie.test\\r\\nOrigin: https://private-roomie.test\\r\\nContent-Type: application/json\\r\\nContent-Length: 2\\r\\nConnection: close\\r\\n\\r\\n{}'));s.on('data',b=>data+=b);s.on('end',()=>resolve(Number(data.split(' ')[1])));});
    const tcp=new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port:${new URL(f.server.gatewayUrl).port}});s.on('connect',()=>{s.destroy();resolve(false)});s.on('error',()=>resolve(true));s.setTimeout(1000,()=>{s.destroy();resolve(true)});});
    Promise.all([tcp,probe('/api/auth/gateway'),probe(${JSON.stringify(f.server.gatewayUrl + '/api/auth/gateway')})]).then(v=>console.log(JSON.stringify(v)));
  `,
    ]);
    let out = '',
      err = '';
    child.stdout.on('data', (b) => (out += b));
    child.stderr.on('data', (b) => (err += b));
    await boundary.done(child);
    assert.equal(child.exitCode, 0, err);
    assert.deepEqual(JSON.parse(out), [true, 403, 403]);
  },
);
