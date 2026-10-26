import {randomUUID} from 'node:crypto';

/** Supervise one host generation outside its event loop. Task calls are serialized. */
export async function superviseHost({
  tasks,
  spawnHost,
  cleanup = async () => {},
  requestDeadlineMs = 60000,
  runDeadlineMs = 300000,
  heartbeatMs = 10000,
  tickMs = 1000,
  renewMs = 10000,
  startupMs = 120000,
  signal,
  report = () => {},
}) {
  const leases = new Map([['startup', Date.now() + startupMs]]);
  let child,
    timer,
    lastHeartbeat = Date.now(),
    lastRenewed = 0;
  let ready = false,
    killing = false,
    held = false,
    reason = 'host exited';
  let queue = Promise.resolve();
  const generation = randomUUID();
  const kill = (why) => {
    if (killing) return;
    killing = true;
    reason = why;
    report({event: 'watchdog-stop', generation, reason, pid: child?.pid});
    if (child?.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  };
  const serialize = (work) => {
    queue = queue.then(work).catch(() => kill('execution lease unavailable'));
    return queue;
  };
  async function hold() {
    held = true; // A lost response can still have created a task; always delete it.
    await tasks.hold();
    lastRenewed = Date.now();
  }
  async function releaseIdle() {
    if (leases.size === 0 && held) {
      await tasks.release();
      held = false;
      report({event: 'lease-idle', generation});
    }
  }
  async function drainCleanup() {
    // Keep renewing the hold through bounded orphan removal after host death.
    const renewal = setInterval(() => void serialize(hold), renewMs);
    let deadline;
    try {
      await Promise.race([
        cleanup(),
        new Promise((_, reject) => {
          deadline = setTimeout(
            () => reject(Error('Orphan cleanup deadline exceeded.')),
            70000,
          );
        }),
      ]);
    } finally {
      clearInterval(renewal);
      clearTimeout(deadline);
      await queue;
    }
  }
  const reply = (id, ok) => {
    if (child?.connected)
      child.send({type: 'roomie-lease-response', id, ok}, () => {});
  };
  const onMessage = (message) => {
    if (message?.type === 'roomie-heartbeat') {
      lastHeartbeat = Date.now();
      return;
    }
    void serialize(async () => {
      if (killing) {
        reply(message?.id, false);
        return;
      }
      if (message?.type === 'roomie-ready') {
        ready = true;
        leases.delete('startup');
        await releaseIdle();
        report({event: 'host-ready', generation, pid: child.pid});
        return;
      }
      const id = message?.id;
      if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) {
        kill('invalid lifecycle message');
        return;
      }
      if (message.type === 'roomie-acquire') {
        if (
          leases.has(id) ||
          leases.size >= 512 ||
          !['request', 'run', 'startup', 'shutdown'].includes(message.kind)
        ) {
          kill('invalid execution lease');
          return;
        }
        const maximum =
          message.kind === 'run'
            ? runDeadlineMs
            : message.kind === 'startup'
              ? startupMs
              : requestDeadlineMs;
        const duration =
          message.deadlineMs === undefined
            ? maximum
            : Math.min(message.deadlineMs, maximum);
        if (!Number.isSafeInteger(duration) || duration <= 0) {
          kill('invalid execution deadline');
          return;
        }
        // Fixed on admission; heartbeat/renewal can never extend this deadline.
        if (leases.size === 0) lastHeartbeat = Date.now(); // Fresh grace after idle/wake.
        leases.set(id, Date.now() + duration);
        if (!held) await hold();
        if (!killing) reply(id, true);
      } else if (message.type === 'roomie-release' && leases.has(id)) {
        leases.delete(id);
        await releaseIdle();
      } else kill('unknown execution lease');
    });
  };
  let stopTimer;
  const stop = () => {
    if (!child) return;
    reason = 'service stopping';
    child.kill('SIGTERM');
    stopTimer ??= setTimeout(() => kill('shutdown deadline exceeded'), 10000);
  };
  try {
    await hold();
    await drainCleanup(); // Orphaned namespace processes must be gone before any new host starts.
    if (killing) throw Error('Execution lease unavailable during cleanup.');
    if (signal?.aborted) return {reason: 'service stopping'};
    child = spawnHost();
    report({event: 'host-start', generation, pid: child.pid});
    signal?.addEventListener('abort', stop, {once: true});
    child.on('message', onMessage);
    child.on('disconnect', () => {
      if (!signal?.aborted) kill('host IPC disconnected');
    });
    timer = setInterval(() => {
      const now = Date.now();
      if (killing) return;
      if ([...leases.values()].some((deadline) => now >= deadline)) {
        kill('execution deadline exceeded');
        return;
      }
      if (ready && leases.size && now - lastHeartbeat > heartbeatMs) {
        kill('host heartbeat expired');
        return;
      }
      if (leases.size && now - lastRenewed >= renewMs) {
        lastRenewed = now; // At most one queued renewal per interval.
        void serialize(async () => {
          if (!killing && leases.size) await hold();
        });
      }
    }, tickMs);
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        report({event: 'host-exit', generation, code, signal});
        resolve();
      });
    });
    return {reason};
  } finally {
    clearInterval(timer);
    clearTimeout(stopTimer);
    signal?.removeEventListener('abort', stop);
    killing = true;
    await queue;
    if (!held) await hold();
    // Child death alone is insufficient: detached tools may live.
    await drainCleanup();
    if (held) await tasks.release();
    report({event: 'generation-drained', generation});
  }
}
