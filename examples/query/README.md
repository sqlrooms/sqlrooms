### [SQL Query Editor](https://query.sqlrooms.org/)

[Try live](https://query.sqlrooms.org/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/query)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/query?embed=1)

[![Netlify Status](https://api.netlify.com/api/v1/badges/779ab00f-9f8f-4c12-92d2-a75426ac0315/deploy-status)](https://app.netlify.com/projects/sqlrooms-query/deploys)

<a href="https://query.sqlrooms.org/" target="_blank">
<img src="/media/examples/sqlrooms-query.webp" alt="SQLRooms SQL Query workbench example" width=450>
</a>

A comprehensive SQL query editor demonstrating SQLRooms' DuckDB integration. Features include:

- Interactive SQL editor with syntax highlighting
- File dropzone for adding data tables to DuckDB
- Schema tree for browsing database tables and columns
- Tabbed interface for working with multiple queries
- Query execution with results data table
- Support for query cancellation
- There is a [version of the example with offline functionality](https://github.com/sqlrooms/examples/tree/main/query-pwa) which supports Progressive Web App (PWA) features, persistent database storage with OPFS, and state persistence via local storage

To create a new project from the query example run this:

```bash
npx giget gh:sqlrooms/examples/query my-new-app/
```

#### Running locally

```sh
npm install
npm run dev
```
