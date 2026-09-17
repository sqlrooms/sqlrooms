import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {superviseExternalWorker} from './supervise-external.mjs';

for (const mode of ['deadline', 'cancelled'])
  test(`reaps stuck setup and temporary resources on ${mode}`, async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), 'sqlrooms-supervisor-test-'),
    );
    const outputDir = path.join(root, 'attempt');
    const workerPath = path.join(root, 'stuck.mjs');
    const controller = new AbortController();
    let cancel;
    try {
      await writeFile(
        workerPath,
        `import {mkdirSync,writeFileSync} from 'node:fs';
      const directory=process.argv[3]; mkdirSync(directory); mkdirSync(directory+'/workspace');
      writeFileSync(directory+'/pid',String(process.pid));
      process.send({kind:'workspace',value:directory+'/workspace',active:true});
      process.on('SIGTERM',()=>{}); setInterval(()=>{},1000);`,
      );
      if (mode === 'cancelled')
        cancel = setTimeout(() => controller.abort(), 300);
      const code = await superviseExternalWorker({
        workerPath,
        outputDir,
        timeoutMs: mode === 'deadline' ? 300 : 5000,
        graceMs: 100,
        signal: controller.signal,
      });
      assert.equal(code, mode === 'deadline' ? 124 : 130);
      const report = JSON.parse(
        await readFile(path.join(outputDir, 'supervisor.json'), 'utf8'),
      );
      assert.equal(report.forced, true);
      assert.equal(report.reason, mode);
      assert.deepEqual(report.cleanupErrors, []);
      await assert.rejects(readFile(path.join(outputDir, 'workspace')));
      const pid = Number(await readFile(path.join(outputDir, 'pid'), 'utf8'));
      assert.throws(() => process.kill(pid, 0));
    } finally {
      clearTimeout(cancel);
      await rm(root, {recursive: true, force: true});
    }
  });
