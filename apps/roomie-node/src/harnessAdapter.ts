/** Host-owned lifecycle callbacks shared by native harness adapters. */
export type HarnessAdapterOptions = {
  cwd: string;
  mcpUrl: string;
  token: string;
  executable?: string;
  model?: string;
  onEvent: (
    kind: string,
    payload: Record<string, unknown>,
    nativeEventId?: string,
  ) => void;
  onApproval: (
    nativeId: string | number,
    callId: string,
    summary: string,
  ) => void;
  onComplete: (
    status: 'succeeded' | 'failed' | 'interrupted',
    reason: string,
  ) => void;
  onExit: (reason: string) => void;
};
/** A bounded native process; the supervisor owns deadlines, durable decisions and drain. */
export type HarnessAdapter = {
  start: (text: string, onSession: (id: string) => void) => Promise<unknown>;
  approve: (id: string | number, decision: 'approve' | 'deny') => void;
  stop: () => Promise<void>;
  done: Promise<void>;
};
