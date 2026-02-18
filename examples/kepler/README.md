### [Kepler.gl Geospatial Visualization](https://kepler.sqlrooms.org/)

[Try live](https://kepler.sqlrooms.org/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/kepler)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/kepler?embed=1&file=src/app.tsx)

[![Netlify Status](https://api.netlify.com/api/v1/badges/888420a3-33e4-4142-a3b5-03a61c44e09a/deploy-status)](https://app.netlify.com/projects/sqlrooms-kepler/deploys)

<a href="https://kepler.sqlrooms.org/" target="_blank">
  <img src="/media/examples/kepler.webp" alt="SQLRooms Kepler.gl geospatial visualization example" width=450>
</a>

An example demonstrating [Kepler.gl](https://kepler.gl/) integration for geospatial data visualization. Features include:

- Load earthquakes dataset into DuckDB
- Add data as a Kepler layer for map visualization
- Interactive map controls and filtering
- Rich styling options for geospatial layers

To create a new project from the kepler example run this:

```sh
npx giget gh:sqlrooms/examples/kepler my-new-app/
```

#### Running locally

```sh
npm install
npm dev
```
