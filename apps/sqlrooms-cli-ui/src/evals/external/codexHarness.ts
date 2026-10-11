import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {finished} from 'node:stream/promises';
import {StringDecoder} from 'node:string_decoder';

/** A bounded process result; raw harness streams are retained separately. */
export type HarnessResult = {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  cancelled: boolean;
  outputLimited: boolean;
  stdout: string;
  stderr: string;
};

/** Runs one actual process and kills its process group on timeout or cancellation. */
export async function runHarnessProcess(options: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal?: AbortSignal;
  evidencePrefix: string;
  onProcess?: (pid: number, active: boolean) => void;
}): Promise<HarnessResult> {
  const stdoutFile = createWriteStream(
    `${options.evidencePrefix}.stdout.jsonl`,
    {flags: 'wx'},
  );
  const stderrFile = createWriteStream(`${options.evidencePrefix}.stderr.log`, {
    flags: 'wx',
  });
  let stdout = '',
    stderr = '',
    bytes = 0;
  const stdoutDecoder = new StringDecoder('utf8');
  const stderrDecoder = new StringDecoder('utf8');
  let timedOut = false,
    cancelled = false,
    outputLimited = false;
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (child.pid) options.onProcess?.(child.pid, true);
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const kill = (signal: NodeJS.Signals) => {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  const stop = () => {
    kill('SIGTERM');
    killTimer ??= setTimeout(() => kill('SIGKILL'), 2_000);
  };
  const abort = () => {
    cancelled = true;
    stop();
  };
  const timeout = setTimeout(() => {
    timedOut = true;
    stop();
  }, options.timeoutMs);
  options.signal?.addEventListener('abort', abort, {once: true});
  if (options.signal?.aborted) abort();
  const append = (chunk: Buffer, stream: 'stdout' | 'stderr') => {
    bytes += chunk.length;
    if (bytes > 8 * 1024 * 1024) {
      outputLimited = true;
      stop();
      return;
    }
    if (stream === 'stdout') {
      stdout += stdoutDecoder.write(chunk);
      stdoutFile.write(chunk);
    } else {
      stderr += stderrDecoder.write(chunk);
      stderrFile.write(chunk);
    }
  };
  child.stdout.on('data', (chunk) => append(chunk, 'stdout'));
  child.stderr.on('data', (chunk) => append(chunk, 'stderr'));
  try {
    const result = await new Promise<{
      exitCode: number | null;
      signal: string | null;
    }>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (exitCode, signal) => resolve({exitCode, signal}));
    });
    stdout += stdoutDecoder.end();
    stderr += stderrDecoder.end();
    return {...result, timedOut, cancelled, outputLimited, stdout, stderr};
  } finally {
    clearTimeout(timeout);
    if (killTimer) clearTimeout(killTimer);
    options.signal?.removeEventListener('abort', abort);
    kill('SIGKILL');
    if (child.pid) options.onProcess?.(child.pid, false);
    stdoutFile.end();
    stderrFile.end();
    await Promise.all([finished(stdoutFile), finished(stderrFile)]);
  }
}

/** Codex's supported CLI automation and repo skill discovery, with explicit local MCP configuration. */
export function codexArguments(options: {
  cwd: string;
  url: string;
  model: string;
  modelProvider?: 'codex' | 'openrouter';
  prompt: string;
  disabledSkills: string[];
}) {
  return [
    'exec',
    '--ignore-user-config',
    '--ignore-rules',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--json',
    '--color',
    'never',
    '-C',
    options.cwd,
    '--model',
    options.model,
    ...(options.modelProvider === 'openrouter'
      ? [
          '-c',
          'model_provider="openrouter"',
          '-c',
          'model_providers.openrouter={name="OpenRouter",base_url="https://openrouter.ai/api/v1",env_key="OPENROUTER_API_KEY",wire_api="responses",requires_openai_auth=false}',
        ]
      : []),
    '-c',
    'model_reasoning_effort="medium"',
    '-c',
    'skills.config=[' +
      options.disabledSkills
        .map((skill) => `{path=${JSON.stringify(skill)},enabled=false}`)
        .join(',') +
      ']',
    '-c',
    `mcp_servers.sqlrooms={url=${JSON.stringify(options.url)},bearer_token_env_var="SQLROOMS_EVAL_MCP_TOKEN",required=true,startup_timeout_sec=20,tool_timeout_sec=35}`,
    '-c',
    'mcp_servers.sqlrooms.default_tools_approval_mode="approve"',
    '$sqlrooms\n\n' + options.prompt,
  ];
}
