# SQLRooms minimal example

A tiny Vite application demonstrating the basic usage of SQLRooms.

This example contains:

- **A project store** that sets up a single main panel ("MainView") using SQLRooms' project builder utilities. The store also defines a data source: a CSV file of California earthquakes loaded from a public URL.
- **A MainView panel** that uses a SQL query (executed in the browser using DuckDB WASM) to calculate and display summary statistics about the earthquake data.
- The UI is built with simple components and shows loading and error states for the data and query.

## Running locally

```
npm install
npm run dev
```
