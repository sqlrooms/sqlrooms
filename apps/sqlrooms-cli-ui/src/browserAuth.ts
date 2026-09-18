/** Explicit, tab-local authorization for the configured SQLRooms instance. */
export type BrowserAuthorization = {
  token: string;
  binding: string;
  expiresAt: number;
};

let authorization: BrowserAuthorization | undefined;
let storageKey: string | undefined;
let renewalTimer: ReturnType<typeof setTimeout> | undefined;
const RECOVERY =
  'SQLRooms authorization is required. Open a fresh launch link from the SQLRooms terminal or authorized local client.';

function storeSession(value?: BrowserAuthorization) {
  if (!storageKey) return;
  try {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  } catch {
    // Storage may be disabled. Memory remains authoritative for this page only.
  }
}

function clearSession() {
  authorization = undefined;
  storeSession();
  clearTimeout(renewalTimer);
}

function isSession(value: unknown): value is BrowserAuthorization {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrowserAuthorization>;
  return (
    typeof candidate.token === 'string' &&
    typeof candidate.binding === 'string' &&
    typeof candidate.expiresAt === 'number'
  );
}

/** Reject arbitrary endpoints and redirects before attaching a page credential. */
export function authorizationHeaders(
  url: string | URL,
): Record<string, string> {
  const target = new URL(url, location.href);
  if (target.origin !== location.origin || target.username || target.password) {
    throw new Error('Refusing to send SQLRooms credentials to another origin.');
  }
  if (!authorization || authorization.expiresAt * 1000 <= Date.now()) {
    clearSession();
    throw new Error(RECOVERY);
  }
  return {Authorization: `Bearer ${authorization.token}`};
}

/** Fetch only the current instance, with no ambient credentials or redirects. */
export async function authorizedFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(authorizationHeaders(url)))
    headers.set(name, value);
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
  });
  if (response.status === 401) clearSession();
  return response;
}

function scheduleRenewal() {
  clearTimeout(renewalTimer);
  if (!authorization) return;
  renewalTimer = setTimeout(
    async () => {
      try {
        const response = await authorizedFetch('/api/auth/renew', {
          method: 'POST',
        });
        if (!response.ok) throw new Error(RECOVERY);
        const next: unknown = await response.json();
        if (
          !isSession(next) ||
          next.binding !== authorization?.binding ||
          next.token !== authorization.token
        )
          throw new Error(RECOVERY);
        authorization = next;
        storeSession(next);
        scheduleRenewal();
      } catch {
        // Failed renewal never extends local expiry. Existing sockets expire at
        // the same server deadline; recovery requires a fresh launch ticket.
      }
    },
    Math.max(1000, authorization.expiresAt * 1000 - Date.now() - 60_000),
  );
}

/** Consume a single-use fragment before loading any workspace/application code. */
export async function bootstrapAuthorization(): Promise<void> {
  authorization = undefined;
  clearTimeout(renewalTimer);
  const params = new URLSearchParams(location.hash.slice(1));
  const ticket = params.get('sqlrooms-ticket');
  if (ticket)
    history.replaceState(null, '', location.pathname + location.search);
  const identityResponse = await fetch('/auth.json', {
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
  });
  if (!identityResponse.ok) throw new Error(RECOVERY);
  const {binding} = await identityResponse.json();
  if (typeof binding !== 'string') throw new Error(RECOVERY);
  storageKey = `sqlrooms:authorization:${location.origin}:${binding}:page`;
  try {
    const prefix = `sqlrooms:authorization:${location.origin}:`;
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (
        key?.startsWith(prefix) &&
        key.endsWith(':page') &&
        key !== storageKey
      ) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* Storage unavailable: keep only in-memory authorization. */
  }

  if (ticket) {
    const response = await fetch('/api/auth/exchange', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ticket}),
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(RECOVERY);
    authorization = await response.json();
  } else {
    try {
      authorization = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {
      /* memory-only fallback */
    }
  }
  if (
    !isSession(authorization) ||
    authorization.binding !== binding ||
    authorization.expiresAt * 1000 <= Date.now()
  ) {
    clearSession();
    throw new Error(RECOVERY);
  }
  storeSession(authorization);
  scheduleRenewal();
}

/** The short-lived page token used in first-message websocket handshakes. */
export function pageCredential(): string {
  authorizationHeaders('/api/config');
  return authorization!.token;
}
