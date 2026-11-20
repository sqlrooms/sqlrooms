import {fork} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type {ExternalRunResource} from './runScenario.js';

/** Options for {@link superviseExternalWorker}. */
export type SuperviseExternalWorkerOptions = {
  /** Script forked as `<workerPath> --worker <outputDir>`. */
  workerPath: string;
  /** Evidence directory; must not exist yet. */
  outputDir: string;
  /** Whole-suite deadline; defaults to nine minutes. */
  timeoutMs?: number;
  /** Cancellation grace period before forced termination; defaults to ten seconds. */
  graceMs?: number;
  signal?: AbortSignal;
};

/**
 * Bounds the entire evaluation worker, including setup, grading and teardown.
 *
 * The worker reports {@link ExternalRunResource} messages over IPC so the
 * supervisor can kill harness process groups and remove temporary workspaces
 * if the worker cannot settle. Forced termination is never a pass. Returns a
 * process exit code: 130 when cancelled, 124 on deadline.
 */
export async function superviseExternalWorker({
  workerPath,
  outputDir,
  timeoutMs = 540_000,
  graceMs = 10_000,
  signal,
}: SuperviseExternalWorkerOptions): Promise<number> {
  if (existsSync(outputDir))
    throw new Error(
      'Evidence directory already exists. Choose a new attempt directory.',
    );
  const workspaces = new Set<string>();
  const harnesses = new Set<number>();
  const child = fork(workerPath, ['--worker', outputDir], {
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  let reason: 'deadline' | 'cancelled' | null = null,
    forced = false,
    killTimer: ReturnType<typeof setTimeout> | undefined;
  const kill = (pid: number | undefined, signal: NodeJS.Signals) => {
    if (pid === undefined) return;
    try {
      process.kill(-pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  const stop = (why: 'deadline' | 'cancelled') => {
    if (reason) return;
    reason = why;
    kill(child.pid, 'SIGTERM');
    for (const pid of harnesses) kill(pid, 'SIGTERM');
    killTimer = setTimeout(() => {
      forced = true;
      for (const pid of harnesses) kill(pid, 'SIGKILL');
      kill(child.pid, 'SIGKILL');
    }, graceMs);
  };
  child.on('message', (message) => {
    const resource = message as ExternalRunResource;
    if (resource.kind === 'workspace' && typeof resource.value === 'string') {
      if (resource.active) workspaces.add(resource.value);
      else workspaces.delete(resource.value);
    }
    if (resource.kind === 'harness' && Number.isInteger(resource.value)) {
      if (resource.active) harnesses.add(resource.value as number);
      else harnesses.delete(resource.value as number);
    }
  });
  const deadline = setTimeout(() => stop('deadline'), timeoutMs);
  const abort = () => stop('cancelled');
  signal?.addEventListener('abort', abort, {once: true});
  if (signal?.aborted) abort();
  let result:
    | {exitCode: number | null; signal: NodeJS.Signals | null}
    | undefined;
  const cleanupErrors: string[] = [];
  try {
    result = await new Promise<{
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (exitCode, signal) => resolve({exitCode, signal}));
    });
  } finally {
    clearTimeout(deadline);
    clearTimeout(killTimer);
    // The worker's close does not mean its group is gone: a setup subprocess
    // can outlive it. Settle the whole group before returning.
    try {
      kill(child.pid, 'SIGKILL');
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    signal?.removeEventListener('abort', abort);
    for (const pid of harnesses) {
      try {
        kill(pid, 'SIGKILL');
      } catch (error) {
        cleanupErrors.push(String(error));
      }
    }
    for (const directory of workspaces) {
      try {
        rmSync(directory, {recursive: true, force: true});
      } catch (error) {
        cleanupErrors.push(String(error));
      }
    }
    if (!existsSync(outputDir)) mkdirSync(outputDir);
    if (reason || result?.exitCode !== 0 || cleanupErrors.length) {
      const manifestPath = path.join(outputDir, 'manifest.json');
      let manifest: Record<string, unknown> = {};
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        } catch (error) {
          cleanupErrors.push(`Failed to read manifest: ${String(error)}`);
        }
      }
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            ...manifest,
            passed: false,
            supervisorFailure: reason ?? 'worker-failure',
          },
          null,
          2,
        ),
      );
    }
    writeFileSync(
      path.join(outputDir, 'supervisor.json'),
      JSON.stringify(
        {
          reason,
          forced,
          ...result,
          cleanupErrors,
          endedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }
  return reason === 'cancelled'
    ? 130
    : reason === 'deadline'
      ? 124
      : cleanupErrors.length
        ? 1
        : (result?.exitCode ?? 1);
}
