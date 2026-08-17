import {createRoomCapabilityRuntime} from '@sqlrooms/mcp';
import {registerBrowserMcpBridge} from '@sqlrooms/mcp/browser';
import {useEffect} from 'react';
import {createCliRoomCapabilities} from '../createCliRoomCapabilities';
import {runtimeConfig} from '../runtimeEnvironment';
import {useRoomStore} from '../roomStoreHooks';

/** Registers the initialized browser room as the single live MCP target. */
export function CliMcpBridge() {
  const initialized = useRoomStore((state) => state.room.initialized);

  useEffect(() => {
    if (!initialized || !runtimeConfig.mcp) return;
    const runtime = createRoomCapabilityRuntime({
      capabilities: createCliRoomCapabilities(),
      timeoutMs: 30_000,
      maxInputBytes: 256 * 1024,
      maxOutputBytes: 1024 * 1024,
    });
    const bridge = registerBrowserMcpBridge(runtime, {
      url: runtimeConfig.mcp.bridgeUrl,
      token: runtimeConfig.wsAuthToken ?? '',
    });
    return () => {
      bridge.dispose();
      runtime.dispose();
    };
  }, [initialized]);

  return null;
}
