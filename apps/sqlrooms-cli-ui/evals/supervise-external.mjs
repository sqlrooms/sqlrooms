import {fork} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

/** Bounds the entire evaluation worker, including setup, grading and teardown. */
export async function superviseExternalWorker({
  workerPath,
  outputDir,
  timeoutMs = 540_000,
  graceMs = 10_000,
  signal,
}) {
  if (existsSync(outputDir))
    throw new Error(
      'Evidence directory already exists. Choose a new attempt directory.',
    );
  const workspaces = new Set();
  const harnesses = new Set();
  const child = fork(workerPath, ['--worker', outputDir], {
    detached: true,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  let reason = null,
    forced = false,
    killTimer;
  const kill = (pid, signal) => {
    try {
      process.kill(-pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  const stop = (why) => {
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
  child.on('message', (resource) => {
    if (resource.kind === 'workspace' && typeof resource.value === 'string') {
      if (resource.active) workspaces.add(resource.value);
      else workspaces.delete(resource.value);
    }
    if (resource.kind === 'harness' && Number.isInteger(resource.value)) {
      if (resource.active) harnesses.add(resource.value);
      else harnesses.delete(resource.value);
    }
  });
  const deadline = setTimeout(() => stop('deadline'), timeoutMs);
  const abort = () => stop('cancelled');
  signal?.addEventListener('abort', abort, {once: true});
  if (signal?.aborted) abort();
  let result;
  const cleanupErrors = [];
  try {
    result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (exitCode, signal) => resolve({exitCode, signal}));
    });
  } finally {
    clearTimeout(deadline);
    clearTimeout(killTimer);
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
      let manifest = {};
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
