### [Deck.gl Geospatial Visualization](https://sqlrooms-deckgl.netlify.app/)

[Try live](https://sqlrooms-deckgl.netlify.app/)
| [GitHub repo](https://github.com/sqlrooms/examples/tree/main/deckgl)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/deckgl?embed=1&file=src/app.tsx)

[![Netlify Status](https://api.netlify.com/api/v1/badges/b507fcea-e5ec-4822-988d-77857944cf48/deploy-status)](https://app.netlify.com/projects/sqlrooms-deckgl/deploys)

<a href="https://sqlrooms-deckgl.netlify.app/" target="_blank">
  <img src="https://sqlrooms.org/media/examples/deckgl.webp" alt="SQLRooms Deck.gl geospatial visualization example" width=450>
</a>

An example demonstrating [deck.gl](https://deck.gl/) integration for geospatial data visualization through [`@sqlrooms/deck`](../../packages/deck/README.md). Features include:

- Load airports data file into DuckDB
- Define a serializable deck.gl JSON layer spec separately from the data
- Bind multiple named DuckDB-backed datasets into one map
- Visualize airport locations on an interactive map with GeoArrow-backed point layers

To create a new project from the deckgl example run this:

```sh
npx giget gh:sqlrooms/examples/deckgl my-new-app/
```

#### Running Locally

```sh
npm install
npm run dev
```
