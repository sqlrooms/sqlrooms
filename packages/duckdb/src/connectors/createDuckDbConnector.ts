import {DuckDbConnector} from './DuckDbConnector';
import {
  createWasmDuckDbConnector,
  WasmDuckDbConnectorOptions,
  WasmDuckDbConnector,
} from './WasmDuckDbConnector';
import {createWebSocketDuckDbConnector} from './WebSocketDuckDbConnector';

export type DuckDbConnectorType = 'wasm' | 'ws';

export type DuckDbConnectorOptions =
  | ({type: 'wasm'} & WasmDuckDbConnectorOptions)
  | ({type: 'ws'} & {wsUrl?: string; initializationQuery?: string});

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
