import {useEffect, useState} from 'react';
import {registerBrowserMcpBridge} from '@sqlrooms/mcp/browser';
import {
  createLocalCapabilityRuntime,
  requestMcpQueryApproval,
  useMcpQueryApproval,
  resolveMcpQueryApproval,
  cancelAllMcpQueryApprovals,
} from '@sqlrooms/mcp/room';
import {config} from './config';
import {pageCredential} from './auth';
import {roomStore, storage} from './store';

/** External MCP execution keeps the owning browser, approval and save boundaries. */
export function Bridge() {
  const [status, setStatus] = useState('connecting');
  const approval = useMcpQueryApproval();
  useEffect(() => {
    const runtime = createLocalCapabilityRuntime({
      store: roomStore,
      metaNamespace: '__roomie',
      commandFilter: (command) => command.owner === 'roomie',
      policy: {authorize: () => ({allowed: true})},
      approveOperation: (operation, context) =>
        requestMcpQueryApproval({
          ...operation,
          clientName: context.clientInfo?.name ?? 'External MCP client',
          roomTitle: 'Roomie',
          database: roomStore.getState().db.currentDatabase ?? 'main',
          databasePath: config.databasePath,
          signal: context.signal,
        }),
    });
    const bridge = registerBrowserMcpBridge(runtime, {
      url: config.bridgeUrl,
      token: pageCredential(),
      onStatusChange: setStatus,
      onFlush: async () => {
        document.getElementById('workspace')!.inert = true;
        await runtime.drain();
        await storage.flush();
        const state = storage.controller.getState();
        if (state.error || state.dirty || state.saving)
          throw new Error('Changes could not be saved.');
        return {ok: true, lastSavedAt: state.lastSavedAt};
      },
      onResume: () => {
        document.getElementById('workspace')!.inert = false;
      },
    });
    return () => {
      bridge.dispose();
      runtime.dispose();
      cancelAllMcpQueryApprovals();
    };
  }, []);
  return (
    <>
      <span className="text-xs text-slate-500">
        External AI · {status === 'ready' ? 'ready' : status}
      </span>
      {approval.active && (
        <div
          className="roomie-modal"
          role="dialog"
          aria-label="Approve external operation"
        >
          <div className="roomie-dialog">
            <h2>
              Approve{' '}
              {approval.active.kind === 'write'
                ? 'database change'
                : 'external read'}
            </h2>
            <p>
              {approval.active.clientName} requests this operation in{' '}
              {config.databasePath}.
            </p>
            <pre className="my-4 max-h-72 overflow-auto text-xs whitespace-pre-wrap">
              {approval.active.sql}
            </pre>
            <footer>
              <button
                className="roomie-action"
                onClick={() =>
                  resolveMcpQueryApproval(approval.active!.id, 'deny')
                }
              >
                Deny
              </button>
              <button
                className="roomie-action"
                onClick={() =>
                  resolveMcpQueryApproval(approval.active!.id, 'allow')
                }
              >
                Allow once
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
