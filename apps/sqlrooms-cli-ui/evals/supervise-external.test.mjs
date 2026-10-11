import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {superviseExternalWorker} from './supervise-external.mjs';

for (const mode of ['deadline', 'cancelled'])
  for (const manifestContent of [
    undefined,
    '{"attempt":"retained"}',
    '{"attempt":',
    'invalid',
  ])
    test(`reaps stuck setup and temporary resources on ${mode} with manifest ${manifestContent ?? 'absent'}`, async () => {
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
      ${manifestContent === undefined ? '' : `writeFileSync(directory+'/manifest.json',${JSON.stringify(manifestContent)});`}
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
        const invalidManifest =
          manifestContent === '{"attempt":' || manifestContent === 'invalid';
        if (invalidManifest) {
          assert.equal(report.cleanupErrors.length, 1);
          assert.match(
            report.cleanupErrors[0],
            /Failed to read manifest: SyntaxError/,
          );
        } else {
          assert.deepEqual(report.cleanupErrors, []);
        }
        const manifest = JSON.parse(
          await readFile(path.join(outputDir, 'manifest.json'), 'utf8'),
        );
        assert.equal(manifest.passed, false);
        assert.equal(manifest.supervisorFailure, mode);
        if (manifestContent === '{"attempt":"retained"}')
          assert.equal(manifest.attempt, 'retained');
        await assert.rejects(stat(path.join(outputDir, 'workspace')), {
          code: 'ENOENT',
        });
        const pid = Number(await readFile(path.join(outputDir, 'pid'), 'utf8'));
        assert.throws(() => process.kill(pid, 0));
      } finally {
        clearTimeout(cancel);
        await rm(root, {recursive: true, force: true});
      }
    });
