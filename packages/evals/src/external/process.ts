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
  /** Process deadline; zero or less runs without one. */
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
  // Zero or less disables the deadline.
  const timeout =
    options.timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          stop();
        }, options.timeoutMs)
      : undefined;
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
