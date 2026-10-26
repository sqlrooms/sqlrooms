import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readlink,
  rm,
  symlink,
  copyFile,
  realpath,
} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {
  prepareIsolatedHarness,
  recoverIsolatedHarnesses,
} from '../dist-test/bridge.mjs';

const runtimeDirectory = process.env.ROOMIE_BWRAP_RUNTIME;
const enabled = {skip: !runtimeDirectory, timeout: 60000};
const isolation = {backend: 'bubblewrap', runtimeDirectory};
async function fixture(t, deadlineMs = 15000, mode = isolation) {
  const root = await mkdtemp(join(tmpdir(), 'rb-'));
  const cwd = join(root, 'input');
  await mkdir(cwd);
  await writeFile(join(root, 'meta.sqlite'), 'private-canary');
  await writeFile(join(cwd, 'input.txt'), 'intentional input');
  await symlink(join(root, 'meta.sqlite'), join(cwd, 'escape'));
  const boundary = await prepareIsolatedHarness({
    isolation: mode,
    cwd,
    workspaceDirectory: root,
    mcpUrl: 'http://127.0.0.1:1/mcp',
    token: 'scoped-canary',
    deadlineMs,
  });
  t.after(async () => {
    await boundary.dispose();
    await recoverIsolatedHarnesses(root, mode);
    await rm(root, {recursive: true, force: true});
  });
  return {root, cwd, boundary};
}
async function collect(boundary, command, args) {
  const child = boundary.spawn(command, args);
  let out = '',
    err = '';
  child.stdout.on('data', (chunk) => (out += chunk));
  child.stderr.on('data', (chunk) => (err += chunk));
  // Keep the owner's stdin alive: EOF is intentionally cancellation.
  await boundary.done(child);
  return {child, out, err};
}
test(
  'Bubblewrap denies host files, process access, sockets and direct network with real runtimes',
  enabled,
  async (t) => {
    const {root, boundary} = await fixture(t);
    const abstract = '\0roomie-' + randomUUID();
    const listener = net.createServer((socket) => socket.destroy());
    await new Promise((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(abstract, resolve);
    });
    t.after(() => new Promise((resolve) => listener.close(resolve)));
    const script = `
    const fs=require('node:fs'), cp=require('node:child_process'), net=require('node:net');
    const denied=p=>{try{fs.readFileSync(p);return false}catch{return true}};
    const paths=${JSON.stringify([join(root, 'meta.sqlite'), '/work/escape', '/proc/1/root' + join(root, 'meta.sqlite'), '/.sprite/api.sock', '/var/run/docker.sock'])};
    const results={files:paths.map(denied),status:fs.readFileSync('/proc/self/status','utf8'),namespace:fs.readlinkSync('/proc/self/ns/pid')};
    fs.writeFileSync('/work/output.txt','yes');
    results.input=fs.readFileSync('/work/input.txt','utf8');
    results.codex=cp.execFileSync('codex',['--version'],{encoding:'utf8'}).trim();
    results.claude=cp.execFileSync('claude',['--version'],{encoding:'utf8'}).trim();
    results.nested=cp.execFileSync('codex',['sandbox','--','/bin/echo','nested-ok'],{encoding:'utf8'}).trim();
    try{process.setuid(0);results.elevated=true}catch{results.elevated=false}
    const probes=[{path:${JSON.stringify(abstract)}},{path:'/.sprite/api.sock'},{host:'127.0.0.1',port:8080}];
    Promise.all(probes.map(o=>new Promise(resolve=>{const s=net.connect(o);s.on('connect',()=>{s.destroy();resolve(false)});s.on('error',()=>resolve(true));s.setTimeout(1000,()=>{s.destroy();resolve(true)});}))).then(network=>console.log(JSON.stringify({...results,network})));
  `;
    const {child, out, err} = await collect(boundary, 'node', ['-e', script]);
    assert.equal(child.exitCode, 0, err);
    const result = JSON.parse(out);
    assert.ok(result.files.every(Boolean));
    assert.ok(result.network.every(Boolean));
    assert.notEqual(result.namespace, await readlink('/proc/self/ns/pid'));
    assert.equal(result.elevated, false);
    assert.equal(result.input, 'intentional input');
    assert.match(result.status, /CapEff:\s+0+\n/);
    assert.match(result.status, /NoNewPrivs:\s+1/);
    assert.match(result.codex, /0\.163\.0/);
    assert.match(result.claude, /2\.1\.310/);
    assert.equal(result.nested, 'nested-ok');
  },
);

test(
  'Bubblewrap external deadline and recovery remove detached descendants',
  enabled,
  async (t) => {
    for (const recovery of [false, true]) {
      const {root, boundary} = await fixture(t, recovery ? 15000 : 700);
      const marker = `roomie-orphan-${process.pid}-${recovery}`;
      const child = boundary.spawn('node', [
        '-e',
        `require('node:child_process').spawn('node',['-e','setInterval(()=>{},1000)',${JSON.stringify(marker)}],{detached:true,stdio:'ignore'}).unref(); console.log('ready');setInterval(()=>{},1000);`,
      ]);
      let output = '',
        err = '';
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (err += chunk));
      for (let n = 0; n < 200 && !output.includes('ready'); n++)
        await delay(20);
      assert.match(output, /ready/, err);
      if (recovery) await recoverIsolatedHarnesses(root, isolation);
      await boundary.done(child);
      // Scan only for our unique synthetic command marker, never emit host command lines.
      const {readdir} = await import('node:fs/promises');
      const survivors = [];
      for (const pid of (await readdir('/proc')).filter((p) =>
        /^\d+$/.test(p),
      )) {
        const cmd = await readFile(`/proc/${pid}/cmdline`).catch(() =>
          Buffer.alloc(0),
        );
        if (cmd.toString().split('\0').includes(marker)) survivors.push(pid);
      }
      assert.deepEqual(survivors, []);
    }
  },
);

test(
  'Bubblewrap host liveness is independent of saturated harness stdin',
  enabled,
  async (t) => {
    const {boundary} = await fixture(t, 15000);
    const child = boundary.spawn('node', [
      '-e',
      "process.stdin.pause();console.log('ready');setInterval(()=>{},1000)",
    ]);
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.resume();
    for (let n = 0; n < 200 && !output.includes('ready'); n++) await delay(20);
    assert.match(output, /ready/);
    child.stdin.write(Buffer.alloc(8 * 1024 * 1024));
    await delay(50);
    const start = Date.now();
    child.stdio[3].destroy();
    await Promise.race([
      boundary.done(child),
      delay(4000).then(() => {
        throw Error('Host liveness cleanup stalled');
      }),
    ]);
    assert.ok(Date.now() - start < 4000);
  },
);

test(
  'Bubblewrap recovery kills a delayed startup after its runner has died',
  enabled,
  async (t) => {
    const runtime = await mkdtemp(join(tmpdir(), 'rr-'));
    t.after(() => rm(runtime, {recursive: true, force: true}));
    await mkdir(join(runtime, 'bin'));
    await copyFile(
      await realpath(join(runtimeDirectory, 'bin/node')),
      join(runtime, 'bin/node'),
    );
    for (const name of ['codex', 'claude'])
      await writeFile(join(runtime, 'bin', name), '#!/bin/sh\nexit 1\n', {
        mode: 0o755,
      });
    const marker = join(runtime, 'started');
    // This trusted test wrapper delays bwrap before it can arm parent-death handling.
    await writeFile(
      join(runtime, 'bin/bwrap'),
      `#!/bin/sh\necho $$ > '${marker}'\nsleep 10\nexec '${runtimeDirectory}/bin/bwrap' "$@"\n`,
      {mode: 0o755},
    );
    const mode = {...isolation, runtimeDirectory: runtime};
    const {root, boundary} = await fixture(t, 20000, mode);
    const child = boundary.spawn('node', [
      '-e',
      'console.log("must-not-start")',
    ]);
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.resume();
    let wrapper;
    for (let n = 0; n < 200; n++) {
      wrapper = await readFile(marker, 'utf8').catch(() => undefined);
      if (wrapper) break;
      await delay(20);
    }
    assert.ok(wrapper, 'Delayed wrapper started');
    child.kill('SIGKILL');
    await delay(30);
    await recoverIsolatedHarnesses(root, mode);
    await boundary.done(child);
    const status = await readFile(`/proc/${wrapper.trim()}/stat`, 'utf8').catch(
      () => '',
    );
    assert.ok(
      !status || status.split(') ')[1].startsWith('Z '),
      'Delayed wrapper was reaped',
    );
    assert.equal(output, '');
  },
);

test(
  'Bubblewrap stale recovery records never signal an unrelated leaderless group',
  enabled,
  async (t) => {
    const {spawn} = await import('node:child_process');
    const root = await mkdtemp(join(tmpdir(), 'rs-'));
    await mkdir(join(root, '.bubblewrap'));
    const child = spawn(
      process.execPath,
      [
        '-e',
        `
    const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    console.log(child.pid); child.unref();
  `,
      ],
      {
        detached: true,
        stdio: ['ignore', 'pipe', 'inherit'],
        env: {PATH: '/usr/bin:/bin'},
      },
    );
    let output = '';
    child.stdout.on('data', (data) => (output += data));
    await new Promise((resolve) => child.once('close', resolve));
    const survivor = Number(output.trim());
    assert.ok(survivor > 1);
    t.after(async () => {
      try {
        process.kill(survivor, 'SIGKILL');
      } catch {}
      await rm(root, {recursive: true, force: true});
    });
    const abandoned = join(root, '.bubblewrap', randomUUID() + '.json.pending');
    await writeFile(abandoned, '{'); // A crash before atomic record publication.
    const nonce = randomUUID();
    await writeFile(
      join(root, '.bubblewrap', nonce + '.json'),
      JSON.stringify({
        pid: child.pid,
        start: '1',
        nonce,
        boot: await readFile('/proc/sys/kernel/random/boot_id', 'utf8'),
        hostNamespace: await readlink('/proc/self/ns/pid'),
      }),
    );
    await recoverIsolatedHarnesses(root, isolation);
    await assert.rejects(readFile(abandoned), {code: 'ENOENT'});
    process.kill(survivor, 0);
    assert.ok(
      !(await readFile(`/proc/${survivor}/stat`, 'utf8'))
        .split(') ')[1]
        .startsWith('Z '),
    );
  },
);
