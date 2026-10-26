import type {ChildProcessWithoutNullStreams} from 'node:child_process';
import {
  prepareBubblewrapHarness,
  recoverBubblewrapHarnesses,
} from './bubblewrapIsolation';

/** Explicit Linux namespace isolation. There is no implicit trusted-local fallback. */
export type HarnessIsolation = {
  backend: 'bubblewrap';
  /** Provisioned Linux runtime containing bin/{node,bwrap,codex,claude}; no account home files. */
  runtimeDirectory: string;
  /** Exact administrator-selected model origins. Defaults to the OpenAI and Anthropic APIs. */
  modelOrigins?: string[];
  /** Explicit model API delegation only. Workspace/Quack/owner credentials are never accepted here. */
  modelEnvironment?: {OPENAI_API_KEY?: string; ANTHROPIC_API_KEY?: string};
};

// Runtime callers include JavaScript and persisted deployment configuration.
// Reject obsolete/unknown profiles before recovery can signal any process.
function validateIsolation(isolation: HarnessIsolation) {
  if (
    !isolation ||
    isolation.backend !== 'bubblewrap' ||
    'image' in isolation ||
    typeof isolation.runtimeDirectory !== 'string' ||
    !isolation.runtimeDirectory
  )
    throw Error(
      'Isolation requires an explicit Bubblewrap runtime; Docker images are no longer supported.',
    );
}

/** Recover only this workspace's positively identified Linux namespace processes. */
export async function recoverIsolatedHarnesses(
  directory: string,
  isolation: HarnessIsolation,
) {
  validateIsolation(isolation);
  await recoverBubblewrapHarnesses(directory);
}
/** Prepared process boundary shared by both native adapters. */
export type IsolatedHarnessProcess = {
  cwd: string;
  mcpUrl: string;
  mcpHost: string;
  spawn: (command: string, args: string[]) => ChildProcessWithoutNullStreams;
  kill: () => void;
  done: (child: ChildProcessWithoutNullStreams) => Promise<void>;
  dispose: () => Promise<void>;
};
/** Prepare the Linux boundary; aggregate memory/CPU-rate/PID quotas are not provided. */
export async function prepareIsolatedHarness(options: {
  isolation: HarnessIsolation;
  cwd: string;
  mcpUrl: string;
  token: string;
  workspaceDirectory: string;
  deadlineMs: number;
}): Promise<IsolatedHarnessProcess> {
  validateIsolation(options.isolation);
  return prepareBubblewrapHarness(options);
}
