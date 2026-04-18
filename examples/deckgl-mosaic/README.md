### [Deck.gl + Mosaic](https://sqlrooms-deckgl-mosaic.netlify.app/)

[Try live](https://sqlrooms-deckgl-mosaic.netlify.app/)
| [GitHub repo](https://github.com/sqlrooms/examples/tree/main/deckgl-mosaic)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/deckgl-mosaic?embed=1&file=src/app.tsx)

[![Netlify Status](https://api.netlify.com/api/v1/badges/e4571f95-9e51-4d4a-8e68-98d6f7c99980/deploy-status)](https://app.netlify.com/projects/sqlrooms-deckgl-mosaic/deploys)

This example is based on the [original demo app](https://github.com/dzole0311/deckgl-duckdb-geoarrow) by [Gjore Milevski](https://github.com/dzole0311).

<video src="https://sqlrooms.org/media/examples/sqlrooms-deckgl-mosaic-1500px.mp4" alt="SQLRooms Deck.gl+Mosaic example app" width="450" controls loop muted></video>

An example showcasing integration with [deck.gl](https://deck.gl/) and the [UWData Mosaic](https://github.com/uwdata/mosaic) package for performant cross-filtering, now routed through [`@sqlrooms/deck`](../../packages/deck/README.md).

The architecture uses Mosaic’s global Coordinator to manage state between linked views using SQL predicates. The map spec stays separate from the data, the current Mosaic-filtered Arrow result is passed into `DeckMap`, and multiple JSON layers reuse that same prepared dataset instead of maintaining a local GeoArrow bridge utility.

To create a new project from the deckgl-mosaic example run this:

```bash
npx giget gh:sqlrooms/examples/deckgl-mosaic my-new-app/
```

#### Running locally

```sh
npm install
npm run dev
```
