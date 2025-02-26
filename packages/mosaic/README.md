This package is part of the SQLRooms framework. It provides React components and hooks for integrating [Mosaic](https://idl.uw.edu/mosaic/) - a visualization library for data exploration and analysis - into SQLRooms applications.

## Overview

Mosaic is a JavaScript library for data visualization and analysis developed by the [Interactive Data Lab (IDL)](https://idl.uw.edu/) at the University of Washington. It combines the expressiveness of declarative visualization grammars with the power of reactive programming and SQL queries.

One of Mosaic's powerful features is its cross-filtering capability powered by DuckDB, allowing users to interactively filter and explore large datasets with millions of records directly in the browser. This enables creating interactive dashboards where selections in one chart automatically filter data in other charts. For an example of this functionality, see the [Cross-Filter Flights demo](https://idl.uw.edu/mosaic/examples/flights-200k.html) which demonstrates interactive filtering across multiple visualizations of a 200,000-record flight dataset.

This package provides:

- React components for rendering Vega-Lite charts using Mosaic
- Hooks for integrating Mosaic with DuckDB in SQLRooms applications
- Utilities for working with Mosaic specifications

## Installation

```bash
npm install @sqlrooms/mosaic
```

## Usage

### VgPlotChart Component

The `VgPlotChart` component renders a Vega-Lite chart using the Mosaic library:

```tsx
import {VgPlotChart, Spec} from '@sqlrooms/mosaic';

const spec: Spec = {
  // Your Vega-Lite specification
};

function MyChart() {
  return <VgPlotChart spec={spec} />;
}
```

### useMosaic Hook

The `useMosaic` hook provides access to the Mosaic connector for DuckDB:

```tsx
import {useMosaic} from '@sqlrooms/mosaic';

function MyComponent() {
  const {isMosaicLoading, mosaicConnector} = useMosaic();

  if (isMosaicLoading) {
    return <div>Loading...</div>;
  }

  // Use mosaicConnector to interact with DuckDB through Mosaic
  return <div>Mosaic is ready!</div>;
}
```

## Resources

- [Mosaic Documentation](https://idl.uw.edu/mosaic/)
- [Cross-Filter Flights Demo](https://idl.uw.edu/mosaic/examples/flights-200k.html)
- [Vega-Lite Documentation](https://vega.github.io/vega-lite/)
- [DuckDB Documentation](https://duckdb.org/docs/)

## License

MIT
