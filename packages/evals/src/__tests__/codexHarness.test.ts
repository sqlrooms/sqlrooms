import {expect, it} from '@jest/globals';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {codexArguments, createCodexHarness} from '../external/codex';
import {runHarnessProcess} from '../external/process';

it('routes Codex through OpenRouter using an environment key and the selected model', () => {
  const options = {
    cwd: '/tmp/fixture',
    url: 'http://127.0.0.1:1234/mcp',
    model: 'deepseek/deepseek-v4-flash-0731',
    prompt: 'Use the workspace.',
    disabledSkills: [] as string[],
    skillName: 'sqlrooms',
    mcpServerName: 'sqlrooms',
    tokenEnvVar: 'SQLROOMS_EVAL_MCP_TOKEN',
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
        // Long enough for a loaded machine to start the child and print.
        timeoutMs: mode === 'timeout' ? 3000 : 20_000,
        signal: controller.signal,
        evidencePrefix: path.join(cwd, 'attempt'),
      });
      if (mode === 'cancellation') {
        // Cancel once the child is running, not on a fixed delay.
        const started = async (): Promise<void> => {
          const text = await readFile(
            path.join(cwd, 'attempt.stdout.jsonl'),
            'utf8',
          ).catch(() => '');
          if (text.trim()) controller.abort();
          else cancel = setTimeout(() => void started(), 50);
        };
        void started();
      }
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
  30_000,
);

it('decodes UTF-8 across chunks and flushes incomplete tails while retaining raw bytes', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'sqlrooms-harness-utf8-'));
  const stdoutBytes = Buffer.concat([
    Buffer.from(JSON.stringify({text: 'é中🌍'}) + '\n'),
    Buffer.from([0xf0, 0x9f]),
  ]);
  const stderrBytes = Buffer.concat([
    Buffer.from('é中🌍'),
    Buffer.from([0xe2, 0x82]),
  ]);
  try {
    const result = await runHarnessProcess({
      command: process.execPath,
      args: [
        '--input-type=module',
        '-e',
        `
        import {setTimeout} from 'node:timers/promises';
        const stdout = Buffer.from(${JSON.stringify([...stdoutBytes])});
        const stderr = Buffer.from(${JSON.stringify([...stderrBytes])});
        for (let i = 0; i < Math.max(stdout.length, stderr.length); i++) {
          if (i < stdout.length) process.stdout.write(stdout.subarray(i, i + 1));
          if (i < stderr.length) process.stderr.write(stderr.subarray(i, i + 1));
          await setTimeout(20);
        }
      `,
      ],
      cwd,
      env: {},
      timeoutMs: 5000,
      evidencePrefix: path.join(cwd, 'attempt'),
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.split('\n')[0]!)).toEqual({text: 'é中🌍'});
    expect(result.stdout).toBe(stdoutBytes.toString('utf8'));
    expect(result.stderr).toBe(stderrBytes.toString('utf8'));
    expect(await readFile(path.join(cwd, 'attempt.stdout.jsonl'))).toEqual(
      stdoutBytes,
    );
    expect(await readFile(path.join(cwd, 'attempt.stderr.log'))).toEqual(
      stderrBytes,
    );
  } finally {
    await rm(cwd, {recursive: true, force: true});
  }
});

it('rejects an existing evidence file as an error instead of crashing', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'sqlrooms-harness-test-'));
  try {
    const run = () =>
      runHarnessProcess({
        command: process.execPath,
        args: ['-e', ''],
        cwd,
        env: {},
        timeoutMs: 20_000,
        evidencePrefix: path.join(cwd, 'attempt'),
      });
    await run();
    await expect(run()).rejects.toMatchObject({code: 'EEXIST'});
  } finally {
    await rm(cwd, {recursive: true, force: true});
  }
});

it('stages and verifies Codex skills without describe()', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sqlrooms-codex-test-'));
  try {
    const skillDir = path.join(root, 'skill');
    await mkdir(skillDir);
    await writeFile(path.join(skillDir, 'SKILL.md'), '# Demo skill\n');
    const harness = createCodexHarness({
      skillDir,
      skillName: 'demo',
      instructions: 'Use the skill.\n',
      findDisabledSkills: async () => ['/home/user/.agents/skills/other'],
    });
    const cwd = path.join(root, 'cwd');
    await mkdir(cwd);
    await harness.stage(cwd);
    expect(
      await readFile(path.join(cwd, '.agents/skills/demo/SKILL.md'), 'utf8'),
    ).toBe('# Demo skill\n');
    const {args} = harness.invocation({
      cwd,
      prompt: 'Go.',
      host: {url: 'http://127.0.0.1:1/mcp', token: 't', credentialFile: ''},
    });
    expect(args.join(' ')).toContain('/home/user/.agents/skills/other');
    const output = {
      finalAnswer: '',
      completed: true,
      failed: false,
      diagnostics: [],
      skillReads: [{command: 'cat SKILL.md', output: 'unrelated'}],
    };
    expect(harness.verifyGuidance(output)).toHaveLength(1);
    expect(
      harness.verifyGuidance({
        ...output,
        skillReads: [{command: 'cat SKILL.md', output: '# Demo skill\n'}],
      }),
    ).toEqual([]);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
