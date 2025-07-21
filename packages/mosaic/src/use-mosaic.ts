import {
  DuckDbConnector,
  useDuckDb,
  isWasmDuckDbConnector,
} from '@sqlrooms/duckdb';
import {Connector, coordinator, wasmConnector} from '@uwdata/mosaic-core';
import {useEffect, useState} from 'react';

let mosaicConnector: Connector;

// TODO: Create MosaicSlice and keep the connector in the store

/**
 * Retrieves a Mosaic connector for the DuckDB database.
 *
 * @returns {Promise<MosaicConnector>} The Mosaic connector for the DuckDB database.
 */
async function getMosaicConnector(duckDb: DuckDbConnector) {
  if (mosaicConnector) {
    return mosaicConnector;
  }
  if (!isWasmDuckDbConnector(duckDb)) {
    throw new Error('Only WasmDuckDbConnector is currently supported');
  }
  await duckDb.initialize();
  mosaicConnector = await coordinator().databaseConnector(
    wasmConnector({
      // @ts-ignore - We install a different version of duckdb-wasm
      duckDb: duckDb.getDb(),
      // @ts-ignore - We install a different version of duckdb-wasm
      connection: duckDb.getConnection(),
    }),
  );
  return mosaicConnector;
}

/**
 * Hook to manage the Mosaic connector.
 *
 * @returns {Object} An object containing the Mosaic connector and a loading state.
 */
export function useMosaic() {
  const [isLoading, setIsLoading] = useState(true);
  const [connector, setConnector] = useState<Connector>();
  const duckDb = useDuckDb();
  useEffect(() => {
    getMosaicConnector(duckDb)
      .then(setConnector)
      .finally(() => setIsLoading(false));
  }, [duckDb]);
  return {isMosaicLoading: isLoading, mosaicConnector: connector};
}
