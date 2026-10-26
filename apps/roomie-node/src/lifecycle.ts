/** Host work registered with a deployment supervisor before execution. */
export type ExecutionLifecycle = {
  /** Release only after the operation, its child processes and persistence drain. */
  acquire(
    kind: 'request' | 'run' | 'startup' | 'shutdown',
    deadlineMs?: number,
  ): Promise<() => Promise<void>>;
};

/** Run ordinary host work under an optional deployment execution lease. */
export async function withExecutionLease<T>(
  lifecycle: ExecutionLifecycle | undefined,
  kind: 'request' | 'shutdown',
  work: () => Promise<T>,
): Promise<T> {
  const release = await lifecycle?.acquire(kind);
  try {
    return await work();
  } finally {
    await release?.();
  }
}
