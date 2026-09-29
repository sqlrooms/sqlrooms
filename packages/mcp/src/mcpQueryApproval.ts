import {useSyncExternalStore} from 'react';

/** Maximum browser approval wait before the request expires. */
export const MCP_QUERY_APPROVAL_TIMEOUT_MS = 25_000;

/** Visible per-request authorization details, without native credentials. */
export type McpQueryApprovalRequest = {
  id: string;
  clientName: string;
  clientVersion?: string;
  roomTitle: string;
  database: string;
  databasePath: string;
  sql: string;
  maxRows?: number;
  kind?: 'external-read' | 'write';
  commandId?: string;
  expiresAt: number;
};

/** Terminal decision for one browser approval request. */
export type McpQueryApprovalDecision =
  | 'allow'
  | 'deny'
  | 'expired'
  | 'cancelled';

type PendingApproval = Omit<McpQueryApprovalRequest, 'expiresAt'> & {
  signal?: AbortSignal;
  resolve: (decision: McpQueryApprovalDecision) => void;
  timeoutMs: number;
  expiresAt?: number;
  timeout?: ReturnType<typeof setTimeout>;
  onAbort: () => void;
};
type ActiveApproval = PendingApproval & {
  expiresAt: number;
  timeout: ReturnType<typeof setTimeout>;
};

type ApprovalSnapshot = {active?: McpQueryApprovalRequest};

let active: ActiveApproval | undefined;
const queue: PendingApproval[] = [];
const listeners = new Set<() => void>();
let snapshot: ApprovalSnapshot = {};

/** Queue one browser approval; settle on decision, expiry or cancellation. */
export function requestMcpQueryApproval(options: {
  clientName: string;
  clientVersion?: string;
  roomTitle: string;
  database: string;
  databasePath: string;
  sql: string;
  maxRows?: number;
  kind?: 'external-read' | 'write';
  commandId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<McpQueryApprovalDecision> {
  if (options.signal?.aborted) return Promise.resolve('cancelled');

  return new Promise((resolve) => {
    const id = createApprovalId();
    const timeoutMs = options.timeoutMs ?? MCP_QUERY_APPROVAL_TIMEOUT_MS;
    const pending: PendingApproval = {
      ...options,
      id,
      timeoutMs,
      resolve,
      onAbort: () => settle(id, 'cancelled'),
    };
    options.signal?.addEventListener('abort', pending.onAbort, {once: true});
    queue.push(pending);
    showNext();
  });
}

/** Resolve the specified visible approval without granting persistent authority. */
export function resolveMcpQueryApproval(
  id: string,
  decision: 'allow' | 'deny',
) {
  settle(id, decision);
}

/** Subscribe to the stable snapshot of the shared browser approval queue. */
export function useMcpQueryApproval() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Cancel active and queued approvals during bridge teardown. */
export function cancelAllMcpQueryApprovals() {
  if (active) finish(active, 'cancelled');
  for (const pending of queue.splice(0)) finish(pending, 'cancelled');
  active = undefined;
  publish();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function settle(id: string, decision: McpQueryApprovalDecision) {
  if (active?.id === id) {
    const pending = active;
    active = undefined;
    finish(pending, decision);
    showNext();
    return;
  }
  const index = queue.findIndex((pending) => pending.id === id);
  if (index < 0) return;
  const [pending] = queue.splice(index, 1);
  if (pending) finish(pending, decision);
  publish();
}

function finish(pending: PendingApproval, decision: McpQueryApprovalDecision) {
  if (pending.timeout !== undefined) clearTimeout(pending.timeout);
  pending.signal?.removeEventListener('abort', pending.onAbort);
  pending.resolve(decision);
}

function showNext() {
  while (!active && queue.length > 0) {
    const pending = queue.shift()!;
    if (pending.signal?.aborted) {
      finish(pending, 'cancelled');
      continue;
    }
    const expiresAt = Date.now() + pending.timeoutMs;
    const timeout = setTimeout(
      () => settle(pending.id, 'expired'),
      pending.timeoutMs,
    );
    active = {...pending, expiresAt, timeout};
  }
  publish();
}

function publish() {
  snapshot = active
    ? {
        active: {
          id: active.id,
          clientName: active.clientName,
          clientVersion: active.clientVersion,
          roomTitle: active.roomTitle,
          database: active.database,
          databasePath: active.databasePath,
          sql: active.sql,
          maxRows: active.maxRows,
          kind: active.kind,
          commandId: active.commandId,
          expiresAt: active.expiresAt,
        },
      }
    : {};
  for (const listener of listeners) listener();
}

function createApprovalId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `approval-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
