# @sqlrooms/duckdb-motherduck

MotherDuck WASM connector for SQLRooms.

This package exposes a `WasmMotherDuckDbConnector` that implements the
`DuckDbConnector` interface using the `@motherduck/wasm-client` library.
It provides query cancellation via MotherDuck's built-in queuing API.
