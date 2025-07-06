import {
  createWasmMotherDuckDbConnector,
  WasmMotherDuckDbConnector,
  WasmMotherDuckDbConnectorOptions,
} from './WasmMotherDuckDbConnector';
import {DuckDbConnector} from '@sqlrooms/duckdb';

export type MotherDuckDbConnectorType = 'wasm-motherduck';

export type MotherDuckDbConnectorOptions = {
  type: MotherDuckDbConnectorType;
} & WasmMotherDuckDbConnectorOptions;

export function createMotherDuckDbConnector(
  options: MotherDuckDbConnectorOptions,
): DuckDbConnector {
  const {type, ...rest} = options;
  switch (type) {
    case 'wasm-motherduck':
      return createWasmMotherDuckDbConnector(rest);
    default:
      throw new Error(`Unsupported MotherDuck connector type: ${type}`);
  }
}

export {createWasmMotherDuckDbConnector};
export type {WasmMotherDuckDbConnector};

export function isWasmMotherDuckDbConnector(
  connector: DuckDbConnector,
): connector is WasmMotherDuckDbConnector {
  return (connector as any).type === 'wasm-motherduck';
}
