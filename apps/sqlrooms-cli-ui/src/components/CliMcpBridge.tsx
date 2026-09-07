import {createRoomCapabilityRuntime} from '@sqlrooms/mcp';
import {registerBrowserMcpBridge} from '@sqlrooms/mcp/browser';
import {useEffect} from 'react';
import {createCliRoomCapabilities} from '../createCliRoomCapabilities';
import {
  cancelAllMcpQueryApprovals,
  requestMcpQueryApproval,
} from '../mcpQueryApproval';
import {roomStore} from '../store';
import {runtimeConfig} from '../runtimeEnvironment';
import {useRoomStore} from '../roomStoreHooks';

/** Registers the initialized browser room as the single live MCP target. */
export function CliMcpBridge() {
  const initialized = useRoomStore((state) => state.room.initialized);

  useEffect(() => {
    if (!initialized || !runtimeConfig.mcp) return;
    const token = runtimeConfig.wsAuthToken;
    if (!token) {
      throw new Error('MCP browser bridge requires a session auth token.');
    }
    const runtime = createRoomCapabilityRuntime({
      capabilities: createCliRoomCapabilities({
        metaNamespace: runtimeConfig.metaNamespace,
      }),
      policy: {
        authorize: async ({capability, input, context}) => {
          if (capability.name !== 'query') return {allowed: true};
          const query = input as {sql: string; maxRows?: number};
          const state = roomStore.getState();
          const decision = await requestMcpQueryApproval({
            clientName: context.clientInfo?.name || 'Unknown MCP client',
            clientVersion: context.clientInfo?.version,
            roomTitle: state.room.config.title,
            database: state.db.currentDatabase || 'main',
            databasePath: runtimeConfig.dbPath || ':memory:',
            sql: query.sql,
            maxRows: query.maxRows ?? 200,
            signal: context.signal,
          });
          if (decision === 'allow') return {allowed: true};
          return {
            allowed: false,
            result: {
              ok: false,
              code:
                decision === 'cancelled' ? 'cancelled' : 'permission_denied',
              message:
                decision === 'expired'
                  ? 'Query approval expired.'
                  : decision === 'cancelled'
                    ? 'Query approval was cancelled.'
                    : 'The user denied this query.',
              ...(decision === 'cancelled' ? {retryable: true} : {}),
            },
          };
        },
      },
      timeoutMs: 30_000,
      maxInputBytes: 256 * 1024,
      maxOutputBytes: 1024 * 1024,
    });
    const bridge = registerBrowserMcpBridge(runtime, {
      url: runtimeConfig.mcp.bridgeUrl,
      token,
    });
    return () => {
      cancelAllMcpQueryApprovals();
      bridge.dispose();
      runtime.dispose();
    };
  }, [initialized]);

  return null;
}
