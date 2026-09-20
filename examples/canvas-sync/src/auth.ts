/** Tab-local authorization for the example's same-origin backend proxy. */
async function authorize() {
  const recovery =
    'Open a fresh example launch link from your local SQLRooms client.';
  const request = (path: string, init: RequestInit = {}) =>
    fetch(path, {
      ...init,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
  const ticket = new URLSearchParams(location.hash.slice(1)).get(
    'sqlrooms-ticket',
  );
  if (ticket)
    history.replaceState(null, '', location.pathname + location.search);
  const identity = await request('/auth.json');
  if (!identity.ok) throw new Error(recovery);
  const {binding} = await identity.json();
  if (typeof binding !== 'string') throw new Error(recovery);
  const key = `sqlrooms-example:${location.origin}:${binding}`;
  let page: {token: string; binding: string; expiresAt: number};
  if (ticket) {
    const response = await request('/api/auth/exchange', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ticket}),
    });
    if (!response.ok) throw new Error(recovery);
    page = await response.json();
  } else {
    page = JSON.parse(sessionStorage.getItem(key) || 'null');
  }
  if (
    !page ||
    page.binding !== binding ||
    typeof page.token !== 'string' ||
    typeof page.expiresAt !== 'number' ||
    page.expiresAt * 1000 <= Date.now()
  ) {
    sessionStorage.removeItem(key);
    throw new Error(recovery);
  }
  sessionStorage.setItem(key, JSON.stringify(page));
  const renew = async () => {
    try {
      const response = await request('/api/auth/renew', {
        method: 'POST',
        headers: {Authorization: `Bearer ${page.token}`},
      });
      if (!response.ok) throw new Error(recovery);
      const next = await response.json();
      if (next.binding !== binding || next.token !== page.token)
        throw new Error(recovery);
      page = next;
      sessionStorage.setItem(key, JSON.stringify(page));
      setTimeout(renew, 60_000);
    } catch {
      sessionStorage.removeItem(key); // Sockets expire; never silently retarget.
    }
  };
  setTimeout(renew, 60_000);
  return page.token as string;
}

export const pageToken = await authorize().catch((error) => {
  const root = document.getElementById('root');
  if (root) root.textContent = String(error);
  throw error;
});
export const databaseUrl = new URL('/ws/duckdb', location.href);
databaseUrl.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
