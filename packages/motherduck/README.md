[MotherDuck](https://motherduck.com/) is a managed DuckDB-in-the-cloud service that enables you to run DuckDB queries both in your browser and in the cloud.

This package exposes a `createWasmMotherDuckDbConnector` function, which allows SQLRooms to connect to MotherDuck.
The connector is implemented using the [`@motherduck/wasm-client`](https://motherduck.com/docs/sql-reference/wasm-client/) library.

See [`examples/query-motherduck`](/examples#query-motherduck) for a usage example.
