# SQLRooms minimal example

A tiny Vite application demonstrating the basic usage of SQLRooms.

This example contains:

- **A room store** that sets up a single main panel ("MainView") using SQLRooms' project builder utilities. The store also defines a data source: a CSV file of California earthquakes loaded from a public URL.
- The UI is built with simple components and shows loading and error states for the data and query.

To create a new project from the minimal example, run:

```sh
npx degit sqlrooms/examples/minimal my-minimal-app/
cd my-minimal-app
npm install
npm run dev
```

## Running locally

```sh
npm install
npm run dev
```
