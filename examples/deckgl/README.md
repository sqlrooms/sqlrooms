### [Deck.gl Geospatial Visualization](https://sqlrooms-deckgl.netlify.app/)

[Try live](https://sqlrooms-deckgl.netlify.app/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/deckgl)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/deckgl?embed=1&file=src/app.tsx)

<a href="https://sqlrooms-deckgl.netlify.app/" target="_blank">
  <img src="/media/examples/deckgl.webp" alt="SQLRooms Deck.gl geospatial visualization example" width=450>
</a>

An example demonstrating [deck.gl](https://deck.gl/) integration for geospatial data visualization. Features include:

- Load airports data file into DuckDB
- Run SQL queries to filter and transform data
- Visualize airport locations on an interactive map
- High-performance WebGL-based rendering

To create a new project from the deckgl example run this:

```sh
npx degit sqlrooms/examples/deckgl my-new-app/
```

#### Running Locally

```sh
npm install
npm run dev
```
