import {createNodeDuckDbConnector} from '@sqlrooms/duckdb-node';

export function createWasmDuckDbConnector() {
  return createNodeDuckDbConnector({
    dbPath: ':memory:',
  });
}

export function createDuckDbConnector() {
  return createWasmDuckDbConnector();
}
