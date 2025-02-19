import {getDuckDb} from '@sqlrooms/duckdb';
import {coordinator, wasmConnector} from '@uwdata/mosaic-core';
import {useEffect, useState} from 'react';

type MosaicConnector = ReturnType<typeof coordinator>['databaseConnector'];
let connector: MosaicConnector;

/**
 * Retrieves a Mosaic connector for the DuckDB database.
 *
 * @returns {Promise<MosaicConnector>} The Mosaic connector for the DuckDB database.
 */
export async function getMosaicConnector() {
  if (connector) {
    return connector;
  }
  const duckDb = await getDuckDb();
  connector = await coordinator().databaseConnector(
    wasmConnector({
      duckDb: duckDb.db,
      connection: duckDb.conn,
    }),
  );
  return connector;
}

/**
 * Hook to manage the Mosaic connector.
 *
 * @returns {Object} An object containing the Mosaic connector and a loading state.
 */
export function useMosaic() {
  const [isLoading, setIsLoading] = useState(true);
  const [connector, setConnector] = useState<MosaicConnector>();
  useEffect(() => {
    getMosaicConnector()
      .then(setConnector)
      .finally(() => setIsLoading(false));
  }, []);
  return {isMosaicLoading: isLoading, mosaicConnector: connector};
}
