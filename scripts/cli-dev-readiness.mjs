const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 1_000;
const DEFAULT_RETRY_DELAY_MS = 100;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait until the CLI API accepts requests or the startup deadline expires. */
export async function waitForCliApi(
  url,
  {
    attemptTimeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  do {
    const remainingMs = Math.max(1, deadline - Date.now());
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(attemptTimeoutMs, remainingMs)),
        ),
      });
      if (response.ok) return;
      lastError = new Error(`CLI API returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    const retryRemainingMs = deadline - Date.now();
    if (retryRemainingMs <= 0) break;
    await delay(Math.min(retryDelayMs, retryRemainingMs));
  } while (Date.now() <= deadline);

  throw new Error(`Timed out waiting for SQLRooms CLI API at ${url}.`, {
    cause: lastError,
  });
}
