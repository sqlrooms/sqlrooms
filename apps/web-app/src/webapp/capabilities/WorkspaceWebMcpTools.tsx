import {createRoomCapabilityRuntime} from '@sqlrooms/mcp';
import {createSqlRoomsRoomCapabilities} from '@sqlrooms/mcp/sqlrooms';
import {registerWebMcpTools} from '@sqlrooms/mcp/webmcp';
import {useBaseRoomStore, type StoreApi} from '@sqlrooms/room-store';
import {useEffect} from 'react';
import type {WorkspaceRoomState} from '../workspace/WorkspaceRoomStore';

/** Registers the initialized workspace capability catalog with WebMCP. */
export function WorkspaceWebMcpTools({
  roomStore,
}: {
  roomStore: StoreApi<WorkspaceRoomState>;
}) {
  const initialized = useBaseRoomStore<WorkspaceRoomState, boolean>(
    (state) => state.room.initialized,
  );

  useEffect(() => {
    if (!initialized) return;

    const runtime = createRoomCapabilityRuntime({
      capabilities: createSqlRoomsRoomCapabilities({store: roomStore}),
      timeoutMs: 30_000,
      maxInputBytes: 256 * 1024,
      maxOutputBytes: 64 * 1024,
    });
    let disposed = false;
    let disposeRegistration: (() => void) | undefined;

    void registerWebMcpTools(runtime, {
      actor: 'browser-agent',
      metadata: {workspaceSurface: 'sqlrooms-web-app'},
    })
      .then((registration) => {
        if (disposed) registration.dispose();
        else disposeRegistration = registration.dispose;
      })
      .catch((error: unknown) => {
        if (!disposed) roomStore.getState().room.captureException(error);
      });

    return () => {
      disposed = true;
      disposeRegistration?.();
      runtime.dispose();
    };
  }, [initialized, roomStore]);

  return null;
}
