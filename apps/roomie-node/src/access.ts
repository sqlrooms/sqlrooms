import {randomBytes} from 'node:crypto';

const secret = () => randomBytes(32).toString('base64url');
type Operation = 'mcp' | 'bootstrap' | 'renew' | 'view' | 'runs' | 'edit';
type Credential = {
  principalId: string;
  operations: ReadonlySet<Operation>;
  expiresAt?: number;
};

/** An HTTP admission failure, with no credential material in the error. */
export function accessDenied(code = 'unauthorized') {
  return Object.assign(new Error(code), {
    status: code === 'unauthorized' ? 401 : 403,
    code,
  });
}

/** Single-owner, per-start credentials and single-use browser tickets. */
export function createWorkspaceAccess(
  options: {
    clock?: () => number;
    pageTtlMs?: number;
    ticketTtlMs?: number;
  } = {},
) {
  const clock = options.clock ?? Date.now;
  const pageTtl = options.pageTtlMs ?? 1_800_000;
  const ticketTtl = options.ticketTtlMs ?? 120_000;
  const binding = secret();
  const ownerToken = secret();
  const credentials = new Map<string, Credential>([
    [
      ownerToken,
      {
        principalId: 'owner',
        operations: new Set(['mcp', 'bootstrap', 'view', 'runs', 'edit']),
      },
    ],
  ]);
  const tickets = new Map<string, number>();
  let closed = false;

  function verify(token: string, operation: Operation) {
    const credential = credentials.get(token);
    if (
      closed ||
      !credential ||
      (credential.expiresAt !== undefined && credential.expiresAt <= clock())
    )
      throw accessDenied();
    if (!credential.operations.has(operation)) throw accessDenied('forbidden');
    return {principalId: credential.principalId, binding};
  }
  function describe(token: string) {
    verify(token, 'renew');
    return {
      token,
      binding,
      expiresAt: credentials.get(token)!.expiresAt! / 1000,
    };
  }
  return {
    binding,
    ownerToken,
    verify,
    issueHarness() {
      if (closed) throw accessDenied();
      const token = secret();
      credentials.set(token, {
        principalId: 'owner',
        operations: new Set(['mcp']),
      });
      return token;
    },
    ticket() {
      if (closed) throw accessDenied();
      for (const [key, expires] of tickets)
        if (expires <= clock()) tickets.delete(key);
      if (tickets.size >= 64) throw accessDenied('too_many_tickets');
      const ticket = secret();
      tickets.set(ticket, clock() + ticketTtl);
      return ticket;
    },
    redeem(ticket: string) {
      const expires = tickets.get(ticket);
      tickets.delete(ticket);
      if (closed || expires === undefined || expires <= clock())
        throw accessDenied();
      for (const [key, value] of credentials)
        if (value.expiresAt !== undefined && value.expiresAt <= clock())
          credentials.delete(key);
      const token = secret();
      // Browser credentials cannot mint tickets or execute owner MCP tools.
      credentials.set(token, {
        principalId: 'owner',
        operations: new Set(['renew', 'view', 'runs', 'edit']),
        expiresAt: clock() + pageTtl,
      });
      return describe(token);
    },
    renew(token: string) {
      verify(token, 'renew');
      credentials.get(token)!.expiresAt = clock() + pageTtl;
      return describe(token);
    },
    revoke(token: string) {
      credentials.delete(token);
    },
    close() {
      closed = true;
      credentials.clear();
      tickets.clear();
    },
  };
}
