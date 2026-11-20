import {describe, expect, it} from '@jest/globals';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {superviseExternalWorker} from '../external/supervise';

describe('superviseExternalWorker', () => {
  for (const mode of ['deadline', 'cancelled'] as const)
    for (const manifestContent of [
      undefined,
      '{"attempt":"retained"}',
      '{"attempt":',
      'invalid',
    ])
      it(`reaps stuck setup and temporary resources on ${mode} with manifest ${manifestContent ?? 'absent'}`, async () => {
        const root = await mkdtemp(
          path.join(tmpdir(), 'sqlrooms-supervisor-test-'),
        );
        const outputDir = path.join(root, 'attempt');
        const workerPath = path.join(root, 'stuck.mjs');
        const controller = new AbortController();
        let cancel: ReturnType<typeof setTimeout> | undefined;
        try {
          await writeFile(
            workerPath,
            `import {mkdirSync,writeFileSync} from 'node:fs';
      const directory=process.argv[3]; mkdirSync(directory); mkdirSync(directory+'/workspace');
      writeFileSync(directory+'/pid',String(process.pid));
      ${manifestContent === undefined ? '' : `writeFileSync(directory+'/manifest.json',${JSON.stringify(manifestContent)});`}
      process.send({kind:'workspace',value:directory+'/workspace',active:true},()=>setTimeout(()=>writeFileSync(directory+'/ready',''),100));
      process.on('SIGTERM',()=>{}); setInterval(()=>{},1000);`,
          );
          if (mode === 'cancelled') {
            // Cancel once the worker has started, not on a fixed delay.
            const started = async (): Promise<void> => {
              const ready = await stat(path.join(outputDir, 'ready')).then(
                () => true,
                () => false,
              );
              if (ready) controller.abort();
              else cancel = setTimeout(() => void started(), 50);
            };
            void started();
          }
          const code = await superviseExternalWorker({
            workerPath,
            outputDir,
            // Long enough for a loaded machine to start the worker.
            timeoutMs: mode === 'deadline' ? 3000 : 20_000,
            graceMs: 100,
            signal: controller.signal,
          });
          expect(code).toBe(mode === 'deadline' ? 124 : 130);
          const report = JSON.parse(
            await readFile(path.join(outputDir, 'supervisor.json'), 'utf8'),
          );
          expect(report.forced).toBe(true);
          expect(report.reason).toBe(mode);
          const invalidManifest =
            manifestContent === '{"attempt":' || manifestContent === 'invalid';
          if (invalidManifest) {
            expect(report.cleanupErrors).toHaveLength(1);
            expect(report.cleanupErrors[0]).toMatch(
              /Failed to read manifest: SyntaxError/,
            );
          } else {
            expect(report.cleanupErrors).toEqual([]);
          }
          const manifest = JSON.parse(
            await readFile(path.join(outputDir, 'manifest.json'), 'utf8'),
          );
          expect(manifest.passed).toBe(false);
          expect(manifest.supervisorFailure).toBe(mode);
          if (manifestContent === '{"attempt":"retained"}')
            expect(manifest.attempt).toBe('retained');
          await expect(
            stat(path.join(outputDir, 'workspace')),
          ).rejects.toMatchObject({code: 'ENOENT'});
          const pid = Number(
            await readFile(path.join(outputDir, 'pid'), 'utf8'),
          );
          expect(() => process.kill(pid, 0)).toThrow();
        } finally {
          clearTimeout(cancel);
          await rm(root, {recursive: true, force: true});
        }
      }, 30_000);

  it('terminates descendants and reported harness groups that outlive the worker', async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), 'sqlrooms-supervisor-test-'),
    );
    const outputDir = path.join(root, 'attempt');
    const workerPath = path.join(root, 'leaky.mjs');
    const pids: number[] = [];
    try {
      // The worker exits on SIGTERM, leaving a SIGTERM-resistant child in its
      // group and a detached harness group it reported over IPC.
      await writeFile(
        workerPath,
        `import {spawn} from 'node:child_process';
      import {mkdirSync,writeFileSync} from 'node:fs';
      const directory=process.argv[3]; mkdirSync(directory);
      const stubborn="process.on('SIGTERM',()=>{});setInterval(()=>{},1000)";
      const setup=spawn(process.execPath,['-e',stubborn],{stdio:'ignore'});
      const harness=spawn(process.execPath,['-e',stubborn],{stdio:'ignore',detached:true});
      writeFileSync(directory+'/pids',JSON.stringify([setup.pid,harness.pid]));
      process.send({kind:'harness',value:harness.pid,active:true});
      process.on('SIGTERM',()=>process.exit(1)); setInterval(()=>{},1000);`,
      );
      const code = await superviseExternalWorker({
        workerPath,
        outputDir,
        timeoutMs: 3000,
        graceMs: 5000,
      });
      expect(code).toBe(124);
      pids.push(
        ...(JSON.parse(
          await readFile(path.join(outputDir, 'pids'), 'utf8'),
        ) as number[]),
      );
      expect(pids).toHaveLength(2);
      // Exited before the grace period, so nothing waited for escalation.
      const report = JSON.parse(
        await readFile(path.join(outputDir, 'supervisor.json'), 'utf8'),
      );
      expect(report.forced).toBe(false);
      // SIGKILL is delivered asynchronously; allow the kernel to reap.
      const alive = (pid: number) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };
      for (let attempt = 0; attempt < 50 && pids.some(alive); attempt++)
        await new Promise((resolve) => setTimeout(resolve, 20));
      expect(pids.filter(alive)).toEqual([]);
    } finally {
      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Already gone.
        }
      }
      await rm(root, {recursive: true, force: true});
    }
  }, 30_000);
});
