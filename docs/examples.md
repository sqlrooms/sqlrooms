---
outline: deep
---

# Example Applications

All example applications are available in our [Examples Repository](https://github.com/sqlrooms/examples). Here's a list of examples:

<!-- ## [Get Started Example](https://github.com/sqlrooms/examples/tree/main/get-started)

[Github repo](https://github.com/sqlrooms/examples/tree/main/get-started)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/get-started?embed=1)

<img src="/media/examples/get-started.webp" alt="SQLRooms get started example" width=450>

A minimal Vite application demonstrating the basic usage of SQLRooms. Features include:

- Sets up an app store and a single main panel using SQLRooms' project builder utilities
- Loads a CSV file of California earthquakes as a data source
- Runs a SQL query in the browser (DuckDB WASM) to show summary statistics
- Simple UI with loading, error, and result states

To create a new project from the get-started example run this:

```bash
npx degit sqlrooms/examples/get-started my-new-app/
``` -->

## [SQL Query Editor](https://query.sqlrooms.org/)

[Try live](https://query.sqlrooms.org/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/query)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/query?embed=1)

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
- Offline functionality: supports Progressive Web App (PWA) features, persistent database storage with OPFS, and state persistence via local storage

To create a new project from the query example run this:

```bash
npx degit sqlrooms/examples/query my-new-app/
```

## [AI-Powered Analytics](https://sqlrooms-ai.netlify.app/)

[Try live](https://sqlrooms-ai.netlify.app/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/ai)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/ai?embed=1&file=components/app-shell.tsx)

<a href="https://sqlrooms-ai.netlify.app/" target="_blank">
  <video src="/media/examples/ai-example-light.mp4" alt="SQLRooms AI example app" width="450" autoplay loop muted></video>
</a>

An advanced example showing how to build an AI-powered analytics application with SQLRooms. Features include:

- Natural language data exploration
- AI-driven data analysis
- Integration with [Vercel AI SDK](https://sdk.vercel.ai/docs/introduction)
- Custom visualization components
- Room state persistence

To create a new project from the AI example run this:

```bash
npx degit sqlrooms/examples/ai my-new-app/
```

## [Deck.gl + Commenting & Annotation](https://sqlrooms-deckgl-discuss.netlify.app/)

[Try live](https://sqlrooms-deckgl-discuss.netlify.app/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/deckgl-discuss)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/deckgl-discuss?embed=1&file=src/app.tsx)

<a href="https://sqlrooms-deckgl-discuss.netlify.app/" target="_blank">
  <img src="/media/examples/deckgl-discuss.webp" alt="SQLRooms Deck.gl with commenting and annotation example" width=450>
</a>

An example showcasing integration with [deck.gl](https://deck.gl/) for geospatial data visualization combined with the [@sqlrooms/discuss](/api/discuss) module for collaborative features. Features include:

- High-performance WebGL-based geospatial visualizations
- Real-time commenting and annotation system
- Contextual discussions tied to specific data points

To create a new project from the deckgl-discuss example run this:

```bash
npx degit sqlrooms/examples/deckgl-discuss my-new-app/
```

## [Next.js + Recharts Example](https://sqlrooms-nextjs.netlify.app/)

[Try live](https://sqlrooms-nextjs.netlify.app/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/nextjs)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/nextjs?embed=1)

<a href="http://sqlrooms-nextjs.netlify.app/" target="_blank">
  <img src="/media/examples/nextjs.webp" alt="SQLRooms Next.js example" width=450>
</a>

A minimalistic [Next.js](https://nextjs.org/) app example featuring:

- [Recharts module](/api/recharts) for data visualization
- [Tailwind 4](https://tailwindcss.com/blog/tailwindcss-v4) for styling (experimental)

To create a new project from the Next.js example run this:

```bash
npx degit sqlrooms/examples/nextjs my-new-app/
```

## [Cosmos – Graph Visualization](http://sqlrooms-cosmos.netlify.app/)

[Try live](http://sqlrooms-cosmos.netlify.app/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/cosmos)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/cosmos?embed=1&file=src/app.tsx)

<a href="http://sqlrooms-cosmos.netlify.app/" target="_blank">
  <img src="/media/examples/cosmos-graph.webp" alt="SQLRooms Graph example showing network visualization" width=450>
</a>

An example demonstrating integration with the [Cosmos](https://github.com/cosmograph-org/cosmos) GPU-accelerated graph visualization library. Features include:

- WebGL-based force-directed layout computation
- High-performance rendering of large networks
- Real-time interaction and filtering capabilities
- Customizable visual attributes and physics parameters
- Event handling for node/edge interactions

To create a new project from the cosmos example run this:

```bash
npx degit sqlrooms/examples/cosmos my-new-app/
```

## [Cosmos – 2D Embedding Visualization](http://sqlrooms-cosmos-embedding.netlify.app/)

[Try live](http://sqlrooms-cosmos-embedding.netlify.app/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/cosmos-embedding)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/cosmos-embedding?embed=1&file=src/app.tsx)

<a href="http://sqlrooms-cosmos-embedding.netlify.app/" target="_blank">
  <img src="/media/examples/cosmos-embedding.webp" alt="SQLRooms 2D Embedding visualization using Cosmos" width=450>
</a>

An example showcasing integration with Cosmos for visualizing high-dimensional data in 2D space. Features include:

- WebGL-powered rendering of 2D embeddings
- GPU-accelerated positioning and transitions
- Dynamic mapping of data attributes to visual properties
- Efficient handling of large-scale embedding datasets
- Interactive exploration with pan, zoom, and filtering

To create a new project from the cosmos-embedding example run this:

```bash
npx degit sqlrooms/examples/cosmos-embedding my-new-app/
```

## [Mosaic Example](https://sqlrooms-mosaic.netlify.app/)

[Try live](https://sqlrooms-mosaic.netlify.app/)
| [Github repo](https://github.com/sqlrooms/examples/tree/main/mosaic)
| [Open in StackBlitz](https://stackblitz.com/github/sqlrooms/examples/tree/main/mosaic?embed=1&file=src/app.tsx)

<a href="https://sqlrooms-mosaic.netlify.app/" target="_blank">
  <img src="/media/examples/mosaic.webp" alt="SQLRooms Mosaic example Vite app" width=400>
</a>

An example demonstrating integration with [Mosaic](https://idl.uw.edu/mosaic/), a powerful interactive visualization framework utilizing DuckDB and high-performance cross-filtering.

Features include:

- Complete project setup using Vite and TypeScript
- Comprehensive data source management and configuration
- Seamless integration with Mosaic for interactive visualizations
- Real-time cross-filtering capabilities across multiple views
- Example dashboards with common visualization types

To create a new project from the mosaic example run this:

```bash
npx degit sqlrooms/examples/mosaic my-new-app/
```

<!--@include: ../examples/query-motherduck/README.md-->

## Looking for More?

Make sure to check out our [Case Studies](/case-studies) page for real-world applications and success stories using SQLRooms.
