## [MotherDuck Cloud Query Editor](https://motherduck.sqlrooms.org/)

[Try live](https://motherduck.sqlrooms.org/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/query-motherduck)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/query-motherduck?embed=1)

<a href="https://motherduck.sqlrooms.org/" target="_blank">
  <img src="/media/examples/motherduck-example.webp" alt="SQLRooms MotherDuck Cloud Query example" width=450>
</a>

A browser-based SQL query editor that connects directly to MotherDuck's cloud-hosted DuckDB using the WASM connector. Features include:

- Example of using the `WasmMotherDuckDbConnector` from [`@sqlrooms/motherduck`](api/motherduck)
- Connect to MotherDuck from the browser using DuckDB WASM
- Run SQL queries against local and cloud datasets
- Attach and query [DuckLake data lake and catalog](https://motherduck.com/docs/integrations/file-formats/ducklake/)

To create a new project from the query-motherduck example run this:

```bash
npx degit sqlrooms/examples/query-motherduck my-new-app/
```
