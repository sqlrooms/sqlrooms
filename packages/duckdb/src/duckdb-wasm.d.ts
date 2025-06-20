declare module '@duckdb/duckdb-wasm/dist/*.wasm?url' {
  const url: string;
  export default url;
}

declare module '@duckdb/duckdb-wasm/dist/*.worker.js?url' {
  const url: string;
  export default url;
}
