import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readFile, rm, stat, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const execute = promisify(execFile);
const launcher =
  process.env.ROOMIE_LAUNCHER ??
  fileURLToPath(new URL('../bin/roomie-node.mjs', import.meta.url));

async function start(t, directory, args = [], env = {}) {
  const child = spawn(process.execPath, [launcher, directory, ...args], {
    cwd: tmpdir(),
    env: {...process.env, ...env, NODE_PATH: ''},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '',
    errors = '';
  child.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  const exited = new Promise((done) =>
    child.once('exit', (code, signal) => done({code, signal})),
  );
  const stop = async (signal = 'SIGTERM') => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal);
    return exited;
  };
  t.after(() => stop());
  const link = await new Promise((done, reject) => {
    const timer = setTimeout(
      () => reject(Error(`Launcher timed out: ${errors}`)),
      60000,
    );
    child.once('error', reject);
    child.once('exit', () => {
      clearTimeout(timer);
      reject(Error(`Launcher exited: ${errors}`));
    });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Browser sign-in .*: (http:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
  });
  const control = JSON.parse(
    output.split('\n').find((line) => line.startsWith('{"url"')),
  );
  return {...control, link, stop, output: () => output};
}
async function signIn(host) {
  const exchange = () =>
    fetch(host.url + '/api/auth/exchange', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Origin: host.url},
      body: JSON.stringify({ticket: new URL(host.link).hash.split('=')[1]}),
    });
  const response = await exchange();
  assert.equal(response.status, 200);
  assert.equal((await exchange()).status, 401);
  return (await response.json()).token;
}
const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});
async function command(host, token, body) {
  const response = await fetch(host.url + '/api/commands', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}

test('launcher validates arguments before creating a workspace', async () => {
  const directory = join(tmpdir(), `roomie-invalid-${process.pid}`);
  for (const args of [
    [],
    ['--port', '-1'],
    ['--port', '1.5'],
    ['--harness', 'unknown'],
    ['--harness', 'codex'],
    ['--trusted-local'],
    [
      '--harness',
      'claude',
      '--trusted-local',
      '--isolation-image',
      'sha256:' + '0'.repeat(64),
    ],
    ['--harness', 'codex', '--isolation-image', 'sha256:' + '0'.repeat(64)],
    [
      '--harness',
      'codex',
      '--trusted-local',
      '--bubblewrap-runtime',
      '/unused',
    ],
    ['--bubblewrap-runtime', '/unused'],
    ...(process.platform === 'darwin'
      ? [['--harness', 'codex', '--bubblewrap-runtime', '/unused']]
      : []),
    ['--deadline-ms', 'Infinity'],
    ['--unknown'],
  ]) {
    await assert.rejects(
      execute(process.execPath, [
        launcher,
        ...(args.length ? [directory, ...args] : []),
      ]),
      /Roomie:/,
    );
  }
  await assert.rejects(stat(directory), {code: 'ENOENT'});
  assert.match(
    (await execute(process.execPath, [launcher, '--help'])).stdout,
    /Node 24.9/,
  );
  assert.match(
    (await execute(process.execPath, [launcher, '--version'])).stdout,
    /0\.0\.0/,
  );
});

test(
  'launcher serves installed UI, commits uploads/documents, rejects duplicate hosts, and recovers after shutdown and crash',
  {timeout: 180000},
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'roomie launch '));
    t.after(() => rm(directory, {recursive: true, force: true}));
    let host = await start(t, directory);
    let page = await signIn(host);
    const owner = JSON.parse(await readFile(host.credentialPath, 'utf8')).token;
    assert.ok(!host.output().includes(owner));
    assert.equal((await stat(host.credentialPath)).mode & 0o777, 0o600);
    assert.equal((await fetch(host.url + '/api/content')).status, 401);
    const html = await fetch(host.url).then((r) => r.text());
    assert.match(html, /Roomie workspace/);
    const assets = [
      ...html.matchAll(/(?:src|href)="(\.?\/assets\/[^"#]+)"/g),
    ].map((m) => m[1]);
    assert.ok(assets.some((p) => p.endsWith('.js')));
    for (const asset of assets)
      assert.equal((await fetch(new URL(asset, host.url))).status, 200);
    const upload = await fetch(
      host.url + '/api/upload?format=csv&table=sales',
      {
        method: 'POST',
        headers: {...headers(page), 'x-roomie-operation': 'launch-upload'},
        body: 'amount\n300\n450\n',
      },
    );
    assert.equal(upload.status, 200);
    const create = {
      commandId: 'block-document.create',
      input: {title: 'Installed launcher report'},
      commit: {operationId: 'launch-create'},
    };
    const created = await command(host, page, create);
    const artifactId = created.data.receipt.artifactId;
    await command(host, page, {
      commandId: 'block-document.create-chart-block',
      input: {
        artifactId,
        blockId: 'chart',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'amount'}},
      },
      commit: {operationId: 'launch-chart', artifactId, expectedRevision: 1},
    });
    await assert.rejects(
      execute(process.execPath, [launcher, directory], {timeout: 60000}),
      /lock|active host/i,
    );
    const other = join(directory, 'other');
    await assert.rejects(
      execute(
        process.execPath,
        [launcher, other, '--port', new URL(host.url).port],
        {timeout: 60000},
      ),
      /EADDRINUSE/,
    );
    // A failed listener startup releases native ownership of the other workspace.
    const recoveredOther = await start(t, other);
    assert.equal((await recoveredOther.stop()).code, 0);
    const oldPage = page;
    const firstLink = host.link;
    assert.equal((await host.stop('SIGINT')).code, 0);
    await assert.rejects(stat(host.credentialPath), {code: 'ENOENT'});
    host = await start(t, directory);
    page = await signIn(host);
    assert.notEqual(host.link, firstLink);
    assert.equal(
      (await fetch(host.url + '/api/content', {headers: headers(oldPage)}))
        .status,
      401,
    );
    assert.deepEqual(await command(host, page, create), created);
    const snapshot = await fetch(host.url + '/api/content', {
      headers: headers(page),
    }).then((r) => r.json());
    assert.equal(snapshot.revisions[artifactId], 2);
    assert.equal(
      snapshot.content.artifacts.artifactsById[artifactId].title,
      'Installed launcher report',
    );
    const staleCredential = dirname(host.credentialPath);
    await host.stop('SIGKILL');
    await rm(staleCredential, {recursive: true, force: true});
    host = await start(t, directory);
    page = await signIn(host);
    assert.deepEqual(await command(host, page, create), created);
    const catalog = await fetch(host.url + '/api/catalog', {
      headers: headers(page),
    }).then((r) => r.json());
    assert.match(JSON.stringify(catalog), /sales/);
    assert.equal((await host.stop()).code, 0);
  },
);

test(
  'optional browser opening receives only a single-use URL as one argument',
  {timeout: 90000},
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'roomie-open-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const bin = join(directory, 'bin');
    await mkdir(bin);
    const capture = join(directory, 'opened.json');
    await writeFile(
      join(bin, process.platform === 'darwin' ? 'open' : 'xdg-open'),
      `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(capture)},JSON.stringify(process.argv.slice(2)));`,
      {mode: 0o755},
    );
    const host = await start(t, join(directory, 'workspace'), ['--open'], {
      PATH: bin + ':' + process.env.PATH,
    });
    for (let i = 0; i < 100 && !(await stat(capture).catch(() => null)); i++)
      await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(JSON.parse(await readFile(capture, 'utf8')), [host.link]);
    await signIn(host);
    assert.equal((await host.stop()).code, 0);
  },
);

for (const adapter of ['codex', 'claude']) {
  test(
    `installed launcher routes ${adapter} through the shared supervisor and drains pending work on stop`,
    {timeout: 90000},
    async (t) => {
      const directory = await mkdtemp(join(tmpdir(), 'roomie-launch-harness-'));
      t.after(() => rm(directory, {recursive: true, force: true}));
      const bin = join(directory, 'bin');
      await mkdir(bin);
      await writeFile(join(directory, 'config.toml'), '');
      await writeFile(
        join(bin, adapter),
        await readFile(new URL(`scripted-${adapter}.mjs`, import.meta.url)),
        {mode: 0o755},
      );
      let host = await start(
        t,
        join(directory, 'workspace'),
        ['--harness', adapter, '--trusted-local'],
        {
          PATH: bin + ':' + process.env.PATH,
          CODEX_HOME: directory,
        },
      );
      let page = await signIn(host);
      const startRun = async (text) => {
        const response = await fetch(host.url + '/api/runs/start', {
          method: 'POST',
          headers: headers(page),
          body: JSON.stringify({idempotencyKey: text, text}),
        });
        assert.equal(response.status, 200);
        return response.json();
      };
      const snapshot = (run) =>
        fetch(
          host.url + '/api/conversations/snapshot?id=' + run.conversationId,
          {headers: headers(page)},
        ).then((r) => r.json());
      const waitFor = async (run, status) => {
        for (let i = 0; i < 300; i++) {
          const value = await snapshot(run);
          if (value.runs.some((r) => r.status === status)) return value;
          if (value.runs.some((r) => r.status === 'failed'))
            throw Error(JSON.stringify(value));
          await new Promise((done) => setTimeout(done, 20));
        }
        throw Error(`Run never became ${status}`);
      };
      const run = await startRun('hello');
      await waitFor(run, 'succeeded');
      const pending = await startRun('approval');
      await waitFor(pending, 'awaiting-approval');
      assert.equal((await host.stop()).code, 0);
      host = await start(t, join(directory, 'workspace'));
      page = await signIn(host);
      const recovered = await snapshot(pending);
      assert.equal(recovered.pendingApprovals.length, 0);
      assert.ok(
        ['cancelled', 'interrupted'].includes(recovered.runs[0].status),
      );
      assert.equal((await snapshot(run)).runs[0].status, 'succeeded');
      assert.equal((await host.stop()).code, 0);
    },
  );
}
