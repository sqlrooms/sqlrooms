import assert from 'node:assert/strict';
import test from 'node:test';

import {waitForCliApi} from './cli-dev-readiness.mjs';

test('CLI API readiness retries until the server responds', async () => {
  let attempts = 0;
  await waitForCliApi('http://127.0.0.1:4273/api/status', {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('connect ECONNREFUSED');
      return {ok: true, status: 200};
    },
    retryDelayMs: 0,
    timeoutMs: 1_000,
  });

  assert.equal(attempts, 3);
});

test('CLI API readiness retries non-success responses', async () => {
  let attempts = 0;
  await waitForCliApi('http://127.0.0.1:4273/api/status', {
    fetchImpl: async () => {
      attempts += 1;
      return {ok: attempts > 1, status: attempts > 1 ? 200 : 503};
    },
    retryDelayMs: 0,
    timeoutMs: 1_000,
  });

  assert.equal(attempts, 2);
});

test('CLI API readiness stays aborted when an in-flight request succeeds', async () => {
  const controller = new AbortController();
  let attemptSignal;
  const readiness = waitForCliApi('http://127.0.0.1:4273/api/status', {
    fetchImpl: async (_url, options) => {
      attemptSignal = options.signal;
      await new Promise((resolve) => setImmediate(resolve));
      return {ok: true, status: 200};
    },
    signal: controller.signal,
    timeoutMs: 1_000,
  });

  controller.abort(new Error('shutdown requested'));

  await assert.rejects(readiness, /shutdown requested/);
  assert.equal(attemptSignal.aborted, true);
});
