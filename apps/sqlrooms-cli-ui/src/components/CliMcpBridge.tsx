import {registerBrowserMcpBridge} from '@sqlrooms/mcp/browser';
import {useEffect} from 'react';
import {createCliCapabilityRuntime} from '../createCliCapabilityRuntime';
import {
  cancelAllMcpQueryApprovals,
  requestMcpQueryApproval,
} from '../mcpQueryApproval';
import {roomStore, uiStatePersistenceController} from '../store';
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
    const runtime = createCliCapabilityRuntime({
      store: roomStore,
      metaNamespace: runtimeConfig.metaNamespace,
      policy: {authorize: () => ({allowed: true})},
      approveOperation: async (operation, context) => {
        const state = roomStore.getState();
        return requestMcpQueryApproval({
          ...operation,
          clientName: context.clientInfo?.name || 'Unknown MCP client',
          clientVersion: context.clientInfo?.version,
          roomTitle: state.room.config.title,
          database: state.db.currentDatabase || 'main',
          databasePath: runtimeConfig.dbPath || ':memory:',
          signal: context.signal,
        });
      },
    });
    const bridge = registerBrowserMcpBridge(runtime, {
      url: runtimeConfig.mcp.bridgeUrl,
      token,
      onFlush: async () => {
        const root = document.getElementById('root');
        if (root) root.inert = true;
        try {
          await runtime.drain();
          await uiStatePersistenceController.flush('managed-close');
          const state = uiStatePersistenceController.getState();
          if (state.error || state.dirty || state.saving) {
            throw new Error('Workspace changes could not be saved.');
          }
          return {ok: true, lastSavedAt: state.lastSavedAt};
        } catch (error) {
          if (root) root.inert = false;
          throw error;
        }
      },
      onResume: () => {
        const root = document.getElementById('root');
        if (root) root.inert = false;
      },
    });
    return () => {
      cancelAllMcpQueryApprovals();
      bridge.dispose();
      runtime.dispose();
    };
  }, [initialized]);

  return null;
}
