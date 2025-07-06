[MotherDuck](https://motherduck.com/) is a managed DuckDB-in-the-cloud service that enables you to run DuckDB queries both in your browser and in the cloud.

This package exposes a `createWasmMotherDuckDbConnector` function, which allows SQLRooms to connect to MotherDuck.
The connector is implemented using the [`@motherduck/wasm-client`](https://motherduck.com/docs/sql-reference/wasm-client/) library which is a customized version of [`@duckdb/duckdb-wasm`](https://github.com/duckdb/duckdb-wasm/tree/main/packages/duckdb-wasm) capable of querying MotherDuck datasets in the cloud from the browser.

## Example

See [`MotherDuck Cloud Query Editor`](/examples#motherduck-cloud-query-editor) for a usage example.
