Example application built with DuckDB-WASM, Mosaic and GeoArrow to query a Parquet file directly in the browser without a backend.

The architecture uses Mosaic’s global Coordinator to manage state between linked views using SQL predicates. Because DuckDB-WASM returns standard Arrow tables, the WKB output is converted to GeoArrow point vectors before being passed to the GeoArrowScatterplotLayer for rendering.

- DuckDB-WASM: https://duckdb.org/docs/stable/clients/wasm/overview
- Mosaic: https://github.com/uwdata/mosaic
- Deck.gl: https://deck.gl/
- @geoarrow/deck.gl-layers: https://www.npmjs.com/package/@geoarrow/deck.gl-layers

## Getting Started

Create `.env` file and add a Mapbox token:

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

Install the dependencies:

```bash
npm install
```

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.
