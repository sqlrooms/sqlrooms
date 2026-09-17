import {expect, it} from '@jest/globals';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runHarnessProcess} from '../external/codexHarness';

it.each(['success', 'failure', 'timeout', 'cancellation'] as const)(
  'retains output and reaps a process on %s',
  async (mode) => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'sqlrooms-harness-test-'));
    const controller = new AbortController();
    let cancel: ReturnType<typeof setTimeout> | undefined;
    try {
      const pending = runHarnessProcess({
        command: process.execPath,
        args: [
          '-e',
          mode === 'success'
            ? 'console.log(process.pid)'
            : mode === 'failure'
              ? 'console.log(process.pid); process.exitCode = 2'
              : 'console.log(process.pid); setInterval(() => {}, 1000)',
        ],
        cwd,
        env: {},
        timeoutMs: mode === 'timeout' ? 300 : 5000,
        signal: controller.signal,
        evidencePrefix: path.join(cwd, 'attempt'),
      });
      if (mode === 'cancellation')
        cancel = setTimeout(() => controller.abort(), 300);
      const result = await pending;
      expect(result.timedOut).toBe(mode === 'timeout');
      expect(result.cancelled).toBe(mode === 'cancellation');
      if (mode === 'success' || mode === 'failure')
        expect(result.exitCode).toBe(mode === 'success' ? 0 : 2);
      const pid = Number(result.stdout.trim());
      expect(pid).toBeGreaterThan(0);
      expect(() => process.kill(pid, 0)).toThrow();
      expect(
        await readFile(path.join(cwd, 'attempt.stdout.jsonl'), 'utf8'),
      ).toBe(result.stdout);
    } finally {
      if (cancel) clearTimeout(cancel);
      await rm(cwd, {recursive: true, force: true});
    }
  },
);
