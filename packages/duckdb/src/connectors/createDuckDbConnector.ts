import {DuckDbConnector} from './DuckDbConnector';
import {
  createWasmDuckDbConnector,
  WasmDuckDbConnectorOptions,
  WasmDuckDbConnector,
} from './WasmDuckDbConnector';

export type DuckDbConnectorType = 'wasm';

export type DuckDbConnectorOptions = {
  type: DuckDbConnectorType;
} & WasmDuckDbConnectorOptions;

export function createDuckDbConnector(
  options: DuckDbConnectorOptions,
): DuckDbConnector {
  const {type, ...rest} = options;
  switch (type) {
    case 'wasm':
      return createWasmDuckDbConnector(rest);
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
