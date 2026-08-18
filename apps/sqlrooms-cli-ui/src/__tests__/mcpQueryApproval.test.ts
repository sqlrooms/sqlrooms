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
});
