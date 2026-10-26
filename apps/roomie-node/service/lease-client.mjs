import {randomUUID} from 'node:crypto';

/** Private parent IPC; never exposed over HTTP, MCP or a harness environment. */
export function connectExecutionLifecycle() {
  if (!process.send || !process.connected)
    throw Error('Managed lifecycle requires parent IPC.');
  const pending = new Map();
  const fail = (reason = 'parent disconnected') => {
    console.error(`Execution lifecycle: ${reason}`);
    process.exit(1); // COMMIT/recovery resolves any interrupted work.
  };
  const send = (value) =>
    new Promise((resolve) => {
      process.send(value, (error) => {
        if (error) fail(`IPC send failed (${error.code ?? 'unknown'})`);
        else resolve();
      });
    });
  const receive = (value) => {
    if (value?.type !== 'roomie-lease-response') return;
    const waiter = pending.get(value.id);
    if (!waiter) return;
    pending.delete(value.id);
    clearTimeout(waiter.timer);
    if (value.ok) waiter.resolve();
    else waiter.reject(Error('Execution lease unavailable.'));
  };
  process.on('message', receive);
  process.on('disconnect', fail);
  const heartbeat = setInterval(() => send({type: 'roomie-heartbeat'}), 1000);
  function exchange(value) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => fail('lease acknowledgement timed out'),
        10000,
      );
      pending.set(value.id, {resolve, reject, timer});
      send(value);
    });
  }
  return {
    async acquire(kind, deadlineMs) {
      const id = randomUUID();
      await exchange({type: 'roomie-acquire', id, kind, deadlineMs});
      let released;
      // Work has drained. Wait only for IPC delivery, not Tasks DELETE: dropping
      // the last hold may suspend the VM before an acknowledgement can arrive.
      return () => (released ??= send({type: 'roomie-release', id}));
    },
    ready() {
      send({type: 'roomie-ready'});
    },
    close() {
      clearInterval(heartbeat);
      process.off('message', receive);
      process.off('disconnect', fail);
      for (const waiter of pending.values()) clearTimeout(waiter.timer);
      pending.clear();
      process.disconnect();
    },
  };
}
