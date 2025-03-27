import {
  DuckDbConnector,
  useDuckDb,
  WasmDuckDbConnector,
} from '@sqlrooms/duckdb';
import {coordinator, wasmConnector} from '@uwdata/mosaic-core';
import {useEffect, useState} from 'react';

type MosaicConnector = ReturnType<typeof coordinator>['databaseConnector'];
let mosaicConnector: MosaicConnector;

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
  if (!(duckDb instanceof WasmDuckDbConnector)) {
    throw new Error('Only WasmDuckDbConnector is currently supported');
  }
  await duckDb.initialize();
  mosaicConnector = await coordinator().databaseConnector(
    wasmConnector({
      duckDb: duckDb.getDb(),
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
  const [connector, setConnector] = useState<MosaicConnector>();
  const duckDb = useDuckDb();
  useEffect(() => {
    getMosaicConnector(duckDb)
      .then(setConnector)
      .finally(() => setIsLoading(false));
  }, [duckDb]);
  return {isMosaicLoading: isLoading, mosaicConnector: connector};
}
