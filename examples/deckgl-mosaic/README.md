### [Deck.gl + Mosaic](https://sqlrooms-deckgl-mosaic.netlify.app/)

[Try live](https://sqlrooms-deckgl-mosaic.netlify.app/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/deckgl-mosaic)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/deckgl-mosaic?embed=1&file=src/app.tsx)

[![Netlify Status](https://api.netlify.com/api/v1/badges/e4571f95-9e51-4d4a-8e68-98d6f7c99980/deploy-status)](https://app.netlify.com/projects/sqlrooms-deckgl-mosaic/deploys)

This example is based on the [original demo app](https://github.com/dzole0311/deckgl-duckdb-geoarrow) by [Gjore Milevski](https://github.com/dzole0311).

<video src="/media/examples/sqlrooms-deckgl-mosaic-1500px.mp4" alt="SQLRooms Deck.gl+Mosaic example app" width="450" controls loop muted></video>

An example showcasing integration with [deck.gl](https://deck.gl/) and [@geoarrow/deck.gl-layers](https://www.npmjs.com/package/@geoarrow/deck.gl-layers) libraries for geospatial data visualization combined with the [UWData Mosaic](https://github.com/uwdata/mosaic) package for performant cross-filtering.

The architecture uses Mosaic’s global Coordinator to manage state between linked views using SQL predicates. Because DuckDB-WASM returns standard Arrow tables, the WKB output is [converted to GeoArrow point vectors](./src/components/map/utils.ts#L26) before being passed to the GeoArrowScatterplotLayer for rendering. Ideally, this function can be replaced with a proper GeoArrow Table constructor in the future once [this feature request](https://github.com/geoarrow/geoarrow-js/issues/42) is implemented.

To create a new project from the deckgl-mosaic example run this:

```bash
npx giget gh:sqlrooms/examples/deckgl-mosaic my-new-app/
```

#### Running locally

```sh
npm install
npm run dev
```
