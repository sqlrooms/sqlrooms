This package is part of the SQLRooms framework and provides flexible layout components for building complex, resizable, and draggable interfaces.

## Overview

The `@sqlrooms/layout` package offers a set of components and utilities for creating dynamic, multi-pane layouts in SQLRooms applications. It's primarily built around the [react-mosaic](https://nomcopter.github.io/react-mosaic/) library, which provides a powerful windowing system similar to the one found in advanced IDEs.

> **Note:** This package uses [react-mosaic](https://nomcopter.github.io/react-mosaic/) which should not be confused with [uwdata/mosaic](https://github.com/uwdata/mosaic) used in the [`@sqlrooms/mosaic`](/api/mosaic/) package for data visualization purposes.

## Installation

```bash
npm install @sqlrooms/layout
```

## Mosaic Tree Structure

The mosaic layout is defined by a tree structure where each node is either a string (representing a panel ID) or an object with `direction`, `first`, `second`, and optional `splitPercentage` properties. Here's an example of how a mosaic tree might look:

```tsx
// Simple two-panel layout with 30/70 split
const simpleMosaicTree = {
  direction: 'row',
  first: 'data-sources', // Left panel (30% width)
  second: 'main', // Right panel (70% width)
  splitPercentage: 30,
};

// More complex nested layout
const complexMosaicTree = {
  direction: 'row',
  first: 'data-sources', // Left panel
  second: {
    // Right side contains a nested layout
    direction: 'column',
    first: 'main', // Top panel
    second: {
      // Bottom contains another nested layout
      direction: 'row',
      first: 'sql-editor',
      second: 'visualization',
      splitPercentage: 50,
    },
    splitPercentage: 60,
  },
  splitPercentage: 20,
};
```

## Components

### MosaicLayout

A wrapper around the `Mosaic` component from react-mosaic-component that provides a customized look and feel consistent with SQLRooms styling.

```tsx
import {MosaicLayout} from '@sqlrooms/layout';

// Example usage
<MosaicLayout
  renderTile={(id, path) => <YourTileContent id={id} />}
  value={yourMosaicTree}
  onChange={handleLayoutChange}
/>;
```

### MosaicTile

A component for rendering individual tiles within the mosaic layout.

## Utility Functions

The package provides several utility functions for working with mosaic layouts:

- `makeMosaicStack`: Creates a stack of mosaic nodes with specified weights and direction
- `visitMosaicLeafNodes`: Traverses all leaf nodes in a mosaic tree
- `getVisibleMosaicLayoutPanels`: Gets an array of all visible panel IDs
- `findMosaicNodePathByKey`: Finds the path to a specific node by its key
- `removeMosaicNodeByKey`: Removes a node from the mosaic tree by its key

## Learn More

For more information about the underlying react-mosaic library, visit:

- [react-mosaic documentation](https://nomcopter.github.io/react-mosaic/)
- [react-mosaic GitHub repository](https://github.com/nomcopter/react-mosaic)

## License

MIT
