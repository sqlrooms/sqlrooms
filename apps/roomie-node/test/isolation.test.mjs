import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  readFile,
  symlink,
} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {
  prepareIsolatedHarness,
  recoverIsolatedHarnesses,
} from '../dist-test/bridge.mjs';
import {openWorkspace, startWorkspaceServer} from '../dist/index.mjs';
const image = process.env.ROOMIE_ISOLATION_IMAGE;
const enabled = {skip: !image, timeout: 120000};
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'roomie-isolation-'));
  const cwd = join(root, 'sessions', 'run');
  await mkdir(cwd, {recursive: true});
  t.after(async () => {
    await recoverIsolatedHarnesses(root);
    await rm(root, {recursive: true, force: true});
  });
  return {root, cwd};
}
async function wait(fn) {
  for (let i = 0; i < 500; i++) {
    const v = await fn();
    if (v) return v;
    await delay(20);
  }
  throw new Error('Timed out');
}
test(
  'real container processes cannot bypass filesystem, credentials, process or privilege boundaries',
  enabled,
  async (t) => {
    const {root, cwd} = await fixture(t);
    const targets = [
      'meta.sqlite',
      'meta.sqlite-wal',
      'data.duckdb',
      'data.duckdb.wal',
      'backup.roomie',
      'owner-credential',
      'other/meta.sqlite',
    ];
    await mkdir(join(root, 'other'));
    for (const path of targets)
      await writeFile(join(root, path), 'private-canary');
    await writeFile(join(cwd, 'input.txt'), 'intentional input');
    await symlink(join(root, 'meta.sqlite'), join(cwd, 'escape'));
    const server = await openWorkspace({directory: join(root, 'workspace')});
    const http = await startWorkspaceServer({workspace: server});
    t.after(async () => {
      await http.dispose();
      await server.dispose();
    });
    const boundary = await prepareIsolatedHarness({
      isolation: {
        image,
        modelEnvironment: {OPENAI_API_KEY: 'delegated-model-canary'},
      },
      cwd,
      workspaceDirectory: root,
      mcpUrl: http.mcpUrl,
      token: 'scoped-run-canary',
      deadlineMs: 20000,
    });
    const script = `
    const fs=require('node:fs'); const cp=require('node:child_process');
    const denied=[]; for(const p of ${JSON.stringify(targets.map((p) => join(root, p)).concat(['/work/escape', '/work/../../meta.sqlite', '/var/run/docker.sock', `/proc/1/root${join(root, 'meta.sqlite')}`]))}) {
      try{fs.readFileSync(p);denied.push(false)}catch{denied.push(true)}
    }
    fs.writeFileSync('/work/output.txt','writable');
    let quota=false;const fd=fs.openSync('/work/fill','w');try {const block=Buffer.alloc(8*1024*1024);for(let i=0;i<40;i++)fs.writeSync(fd,block);}catch(e){quota=e.code==='ENOSPC'}finally{fs.closeSync(fd);fs.unlinkSync('/work/fill')}
    let shellDenied=false;try{cp.execFileSync('sh',['-c','cat \"$1\"','probe',${JSON.stringify(join(root, 'meta.sqlite'))}],{stdio:'pipe'})}catch{shellDenied=true}
    let rootWrite=false;try{fs.writeFileSync('/etc/roomie-escape','bad');rootWrite=true}catch{}
    let elevate=false;try{process.setuid(0);elevate=true}catch{}
    const status=fs.readFileSync('/proc/self/status','utf8');
    console.log(JSON.stringify({denied,shellDenied,rootWrite,elevate,quota,input:fs.readFileSync('/work/input.txt','utf8'),uid:process.getuid(),env:Object.keys(process.env).sort(),status,
      codex:cp.execFileSync('codex',['--version'],{encoding:'utf8'}).trim(),claude:cp.execFileSync('claude',['--version'],{encoding:'utf8'}).trim()}));
  `;
    const child = boundary.spawn('node', ['-e', script]);
    let out = '',
      err = '';
    child.stdout.on('data', (x) => (out += x));
    child.stderr.on('data', (x) => (err += x));
    const done = boundary.done(child);
    await done;
    assert.equal(child.exitCode, 0, err);
    const result = JSON.parse(out);
    assert.ok(result.denied.every(Boolean));
    assert.equal(result.shellDenied, true);
    assert.equal(result.rootWrite, false);
    assert.equal(result.quota, true);
    assert.equal(result.elevate, false);
    assert.equal(result.input, 'intentional input');
    assert.notEqual(result.uid, 0);
    assert.deepEqual(result.env, [
      'HOME',
      'OPENAI_API_KEY',
      'PATH',
      'ROOMIE_RUN_TOKEN',
      'TMPDIR',
    ]);
    assert.match(result.status, /CapEff:\s+0+\n/);
    assert.match(result.status, /NoNewPrivs:\s+1/);
    assert.match(result.codex, /0\.163\.0/);
    assert.match(result.claude, /2\.1\.310/);
    await assert.rejects(readFile(join(cwd, 'output.txt'))); // Run writes stay in bounded tmpfs.
  },
);
test(
  'isolated shared adapter redacts delegated keys, preserves approval/cancel, and reaps containers',
  enabled,
  async (t) => {
    const {root} = await fixture(t);
    const workspace = await openWorkspace({directory: join(root, 'workspace')});
    const server = await startWorkspaceServer({
      workspace,
      harness: {
        adapter: 'claude',
        isolation: {
          image,
          modelEnvironment: {OPENAI_API_KEY: 'model-secret-echo'},
        },
        executable: '/opt/roomie/test-claude.mjs',
        deadlineMs: 20000,
      },
    });
    t.after(async () => {
      await server.dispose();
      await workspace.dispose();
    });
    const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
    async function post(path, body) {
      const r = await fetch(server.url + path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 200);
      return r.json();
    }
    const otherWorkspace = await openWorkspace({
      directory: join(root, 'other-workspace'),
    });
    const otherServer = await startWorkspaceServer({workspace: otherWorkspace});
    t.after(async () => {
      await otherServer.dispose();
      await otherWorkspace.dispose();
    });
    const otherAddress = new URL(otherServer.mcpUrl);
    const otherHost = otherAddress.host;
    if (process.platform === 'darwin')
      otherAddress.hostname = 'host.docker.internal';
    const probe = await post('/api/runs/start', {
      idempotencyKey: 'bypass',
      text:
        'bypass suite:' +
        JSON.stringify({
          other: otherAddress.href,
          otherHost,
          metadata: join(workspace.directory, 'meta.sqlite'),
        }),
    });
    await wait(() => workspace.runs.get(probe.runId).status === 'succeeded');
    const findings = JSON.parse(
      workspace.runs
        .events(0)
        .find((e) => e.runId === probe.runId && e.kind === 'message.text')
        .payload.text,
    );
    assert.equal(findings.ticket.status, 403);
    assert.equal(findings.approval.status, 403);
    assert.equal(findings.other.status, 401);
    assert.equal(findings.query.body.result.structuredContent.ok, false);
    assert.equal(findings.create.body.result.structuredContent.ok, true);
    const artifact =
      findings.create.body.result.structuredContent.data.receipt.artifactId;
    assert.equal((await workspace.snapshot()).revisions[artifact], 1);
    const a = await post('/api/runs/start', {
      idempotencyKey: 'key echo',
      text: 'key echo',
    });
    await wait(() => workspace.runs.get(a.runId).status === 'succeeded');
    assert.ok(
      !JSON.stringify(workspace.runs.events(0)).includes('model-secret-echo'),
    );
    assert.match(
      workspace.runs
        .events(0)
        .find((e) => e.runId === a.runId && e.kind === 'message.text').payload
        .text,
      /\[REDACTED\].*\[REDACTED\]/,
    );
    const b = await post('/api/runs/start', {
      idempotencyKey: 'approval',
      text: 'approval',
    });
    await wait(() => workspace.runs.pending().length);
    assert.equal(workspace.runs.get(b.runId).status, 'awaiting-approval');
    await post('/api/runs/cancel', {runId: b.runId});
    assert.equal(workspace.runs.get(b.runId).status, 'cancelled');
    assert.equal(workspace.runs.pending().length, 0);
    // Cancel while Docker create is still in flight; terminal waits for cleanup.
    const c = await post('/api/runs/start', {
      idempotencyKey: 'startup-cancel',
      text: 'hello',
    });
    await post('/api/runs/cancel', {runId: c.runId});
    assert.equal(workspace.runs.get(c.runId).status, 'cancelled');
  },
);
test(
  'container-local deadline and workspace recovery terminate real descendants',
  enabled,
  async (t) => {
    const {root, cwd} = await fixture(t);
    const create = (deadlineMs) =>
      prepareIsolatedHarness({
        isolation: {image},
        cwd,
        workspaceDirectory: root,
        mcpUrl: 'http://127.0.0.1:1/mcp',
        token: 'fake',
        deadlineMs,
      });
    const boundary = await create(500);
    const child = boundary.spawn('node', [
      '-e',
      "require('child_process').spawn('sh',['-c','sleep 300'],{detached:true,stdio:'ignore'});setInterval(()=>{},1000)",
    ]);
    child.stdin.end();
    await boundary.done(child);
    assert.notEqual(child.exitCode, 0);
    const orphan = await create(20000),
      process = orphan.spawn('node', ['-e', 'setInterval(()=>{},1000)']);
    const exited = new Promise((resolve) => process.once('close', resolve));
    await delay(500);
    await recoverIsolatedHarnesses(root);
    await exited;
    assert.notEqual(process.exitCode, 0);
  },
);

test(
  'missing isolation image fails closed without trusted-local fallback',
  enabled,
  async (t) => {
    const {root} = await fixture(t);
    const workspace = await openWorkspace({directory: join(root, 'workspace')});
    const server = await startWorkspaceServer({
      workspace,
      harness: {
        isolation: {image: 'sha256:' + '0'.repeat(64)},
        adapter: 'claude',
        executable: '/opt/roomie/test-claude.mjs',
      },
    });
    t.after(async () => {
      await server.dispose();
      await workspace.dispose();
    });
    const {token} = JSON.parse(await readFile(server.credentialPath, 'utf8'));
    const response = await fetch(server.url + '/api/runs/start', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({idempotencyKey: 'unavailable', text: 'hello'}),
    });
    assert.equal(response.status, 200);
    const run = await response.json();
    await wait(() => workspace.runs.get(run.runId).status === 'failed');
    assert.equal(
      workspace.runs.events(0).filter((e) => e.kind === 'message.text').length,
      0,
    );
  },
);

test(
  'ambiguous Docker create failure removes the daemon-created container',
  enabled,
  async (t) => {
    const {root, cwd} = await fixture(t);
    const realDocker = execFileSync('which', ['docker'], {
      encoding: 'utf8',
    }).trim();
    const bin = join(root, 'bin'),
      marker = join(root, 'created-id');
    await mkdir(bin);
    await writeFile(
      join(bin, 'docker'),
      `#!/usr/bin/env node\nconst {execFileSync}=require('node:child_process');const fs=require('node:fs');const args=process.argv.slice(2);const out=execFileSync(${JSON.stringify(realDocker)},args,{encoding:'utf8'});if(args[0]==='create'){fs.writeFileSync(${JSON.stringify(marker)},out.trim());process.exit(1)}process.stdout.write(out);`,
      {mode: 0o755},
    );
    const previous = process.env.PATH;
    try {
      process.env.PATH = bin + ':' + previous;
      await assert.rejects(
        prepareIsolatedHarness({
          isolation: {image},
          cwd,
          workspaceDirectory: root,
          mcpUrl: 'http://127.0.0.1:1/mcp',
          token: 'fake',
          deadlineMs: 1000,
        }),
      );
    } finally {
      process.env.PATH = previous;
    }
    const id = await readFile(marker, 'utf8');
    assert.match(id, /^[a-f0-9]{64}$/);
    assert.throws(() =>
      execFileSync(realDocker, ['inspect', id], {stdio: 'pipe'}),
    );
  },
);

test(
  'explicit Codex API-key delegation initializes only the disposable model home',
  enabled,
  async (t) => {
    const {root, cwd} = await fixture(t);
    const boundary = await prepareIsolatedHarness({
      isolation: {
        image,
        modelEnvironment: {OPENAI_API_KEY: 'sk-roomie-synthetic-login-only'},
      },
      cwd,
      workspaceDirectory: root,
      mcpUrl: 'http://127.0.0.1:1/mcp',
      token: 'fake',
      deadlineMs: 10000,
    });
    const child = boundary.spawn('codex', ['login', 'status']);
    let output = '';
    child.stdout.on('data', (x) => (output += x));
    child.stderr.on('data', (x) => (output += x));
    child.stdin.end();
    await boundary.done(child);
    assert.equal(child.exitCode, 0, output);
    assert.match(output, /API key/i);
    await assert.rejects(readFile(join(cwd, '.codex', 'auth.json')));
  },
);
