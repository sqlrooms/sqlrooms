import {DuckDbConnector} from './DuckDbConnector';
import {
  createWasmDuckDbConnector,
  WasmDuckDbConnectorOptions,
  WasmDuckDbConnector,
} from './WasmDuckDbConnector';
import {createWebSocketDuckDbConnector} from './WebSocketDuckDbConnector';

export type DuckDbConnectorType = 'wasm' | 'ws';

/**
 * Options for creating a DuckDB connector instance.
 *
 * @public
 */
export type DuckDbConnectorOptions =
  | ({type: 'wasm'} & WasmDuckDbConnectorOptions)
  | {
      type: 'ws';
      /** WebSocket server URL */
      wsUrl?: string;
      /** SQL to run after connection */
      initializationQuery?: string;
    };

export function createDuckDbConnector(
  options: DuckDbConnectorOptions,
): DuckDbConnector {
  const {type, ...rest} = options;
  switch (type) {
    case 'wasm':
      return createWasmDuckDbConnector(rest);
    case 'ws':
      return createWebSocketDuckDbConnector(rest);
    default:
      throw new Error(`Unsupported DuckDB connector type: ${type}`);
  }
}

export {createWasmDuckDbConnector};
export type {WasmDuckDbConnector};

export function isWasmDuckDbConnector(
  connector: DuckDbConnector,
): connector is WasmDuckDbConnector {
  return (connector as any).type === 'wasm';
}
