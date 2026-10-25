import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

async function recorder(t, behavior) {
  const directory = await mkdtemp(join(tmpdir(), 'roomie-recorder-test-'));
  const bin = join(directory, 'bin');
  await mkdir(bin);
  const pidPath = join(directory, 'child.pid');
  await writeFile(
    join(bin, 'claude'),
    `#!/usr/bin/env node\nimport {writeFileSync} from 'node:fs';\nwriteFileSync(process.env.ROOMIE_FIXTURE_CHILD_PID, String(process.pid));\n${behavior}\nsetInterval(() => {}, 1000);\n`,
    {mode: 0o700},
  );
  const credentialPath = join(directory, 'credential.json');
  await writeFile(
    credentialPath,
    JSON.stringify({
      token: 'synthetic-test-token',
      mcpUrl: 'http://127.0.0.1:1/mcp',
    }),
    {mode: 0o600},
  );
  await writeFile(
    join(directory, 'control.json'),
    JSON.stringify({credentialPath}),
  );
  const child = spawn(
    process.execPath,
    [resolve('test/record-claude-fixtures.mjs'), directory, 'short'],
    {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        ROOMIE_FIXTURE_CHILD_PID: pidPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({code, signal}));
  });
  let pid;
  t.after(async () => {
    child.kill('SIGKILL');
    if (pid) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    await exited;
    await rm(directory, {recursive: true, force: true});
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      pid = Number(await readFile(pidPath, 'utf8'));
      break;
    } catch {
      await delay(20);
    }
  }
  assert.ok(pid, 'native child started');
  return {
    child,
    exited,
    async capture() {
      const folder = (await readdir(directory)).find((name) =>
        name.startsWith('claude-capture-'),
      );
      const captureDirectory = join(directory, folder);
      await assert.rejects(readFile(join(captureDirectory, 'mcp.json')), {
        code: 'ENOENT',
      });
      assert.throws(() => process.kill(pid, 0), {code: 'ESRCH'});
      return JSON.parse(
        await readFile(join(captureDirectory, 'short.json'), 'utf8'),
      );
    },
  };
}

test('recording stdout bound stops a newline-free native frame and removes its credential config', async (t) => {
  const r = await recorder(t, "process.stdout.write('x'.repeat(2100000));");
  await r.exited;
  const records = await r.capture();
  assert.ok(records.some((r) => r.message.type === 'output-limit'));
  assert.equal(records.at(-1).message.signal, 'SIGKILL');
});

test('stopping the recorder terminates its detached native group and removes credentials', async (t) => {
  const r = await recorder(t, '');
  r.child.kill('SIGTERM');
  await r.exited;
  const records = await r.capture();
  assert.ok(records.some((r) => r.message.type === 'operator-stop'));
  assert.equal(records.at(-1).message.signal, 'SIGTERM');
});
