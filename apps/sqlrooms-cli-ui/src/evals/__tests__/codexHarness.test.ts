import {expect, it} from '@jest/globals';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {codexArguments, runHarnessProcess} from '../external/codexHarness';

it('routes Codex through OpenRouter using an environment key and the selected model', () => {
  const options = {
    cwd: '/tmp/fixture',
    url: 'http://127.0.0.1:1234/mcp',
    model: 'deepseek/deepseek-v4-flash-0731',
    prompt: 'Use the workspace.',
    disabledSkills: [],
  };
  const args = codexArguments({...options, modelProvider: 'openrouter'});
  expect(args[args.indexOf('--model') + 1]).toBe(options.model);
  expect(args).toContain('model_provider="openrouter"');
  expect(args).toContain(
    'model_providers.openrouter={name="OpenRouter",base_url="https://openrouter.ai/api/v1",env_key="OPENROUTER_API_KEY",wire_api="responses",requires_openai_auth=false}',
  );
  expect(args).toContain('$sqlrooms\n\nUse the workspace.');
  expect(args).toContain('--sandbox');
  expect(args).toContain('read-only');
  expect(args.some((arg) => arg.startsWith('mcp_servers.sqlrooms='))).toBe(
    true,
  );
  expect(
    codexArguments(options).some((arg) => arg.startsWith('model_provider=')),
  ).toBe(false);
});

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
