import {afterEach, describe, expect, jest, test} from '@jest/globals';
import {
  cancelAllMcpQueryApprovals,
  requestMcpQueryApproval,
} from '../mcpQueryApproval';

const request = {
  clientName: 'Codex',
  roomTitle: 'Workspace',
  database: 'main',
  databasePath: '/tmp/workspace.duckdb',
  sql: 'SELECT 1',
  maxRows: 200,
};

afterEach(() => {
  cancelAllMcpQueryApprovals();
  jest.useRealTimers();
});

describe('MCP query approval', () => {
  test('expires a pending approval', async () => {
    jest.useFakeTimers();
    const decision = requestMcpQueryApproval({...request, timeoutMs: 5});

    await jest.advanceTimersByTimeAsync(5);

    await expect(decision).resolves.toBe('expired');
  });

  test('cancels the dialog when the caller disconnects', async () => {
    const controller = new AbortController();
    const decision = requestMcpQueryApproval({
      ...request,
      signal: controller.signal,
    });

    controller.abort();

    await expect(decision).resolves.toBe('cancelled');
  });

  test('starts a queued approval timeout only when it becomes active', async () => {
    jest.useFakeTimers();
    const firstController = new AbortController();
    const first = requestMcpQueryApproval({
      ...request,
      signal: firstController.signal,
      timeoutMs: 100,
    });
    const second = requestMcpQueryApproval({...request, timeoutMs: 100});
    const secondSettled = jest.fn();
    void second.then(secondSettled);

    await jest.advanceTimersByTimeAsync(90);
    expect(secondSettled).not.toHaveBeenCalled();

    firstController.abort();
    await expect(first).resolves.toBe('cancelled');
    await jest.advanceTimersByTimeAsync(99);
    expect(secondSettled).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await expect(second).resolves.toBe('expired');
  });
});
