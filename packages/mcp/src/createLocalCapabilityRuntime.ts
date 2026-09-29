import {
  createRoomCapabilityRuntime,
  type CreateRoomCapabilityRuntimeOptions,
} from './index';
import {createLocalRoomCapabilities} from './createLocalRoomCapabilities';

/** Shared CLI runtime and bounds; the host must supply its authorization policy. */
export function createLocalCapabilityRuntime(
  options: Omit<
    Parameters<typeof createLocalRoomCapabilities>[0],
    'trackPendingOperation'
  > & {
    policy: NonNullable<CreateRoomCapabilityRuntimeOptions['policy']>;
    onInvocation?: CreateRoomCapabilityRuntimeOptions['onInvocation'];
  },
) {
  const pending = new Set<Promise<unknown>>();
  const track = <T>(operation: Promise<T>): Promise<T> => {
    pending.add(operation);
    void operation.then(
      () => pending.delete(operation),
      () => pending.delete(operation),
    );
    return operation;
  };
  const capabilities = createLocalRoomCapabilities({
    ...options,
    trackPendingOperation: track,
  }).map((capability) => ({
    ...capability,
    execute: (...args: Parameters<typeof capability.execute>) =>
      track(Promise.resolve().then(() => capability.execute(...args))),
  }));
  const runtime = createRoomCapabilityRuntime({
    capabilities,
    policy: options.policy,
    onInvocation: options.onInvocation,
    timeoutMs: 30_000,
    maxInputBytes: 256 * 1024,
    maxOutputBytes: 1024 * 1024,
  });
  return {
    ...runtime,
    /** Waits for actual handlers and commands after dispose has cancelled callers. */
    async drain() {
      while (pending.size) await Promise.allSettled([...pending]);
    },
  };
}
