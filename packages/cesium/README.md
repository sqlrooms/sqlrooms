# @sqlrooms/cesium

Cesium 3D globe visualization for SQLRooms with time-dynamic geospatial data support.

## Features

- **3D Globe Visualization**: Interactive Cesium-powered 3D globe with camera controls
- **SQL Data Integration**: Query DuckDB and visualize results as 3D entities
- **Time-Dynamic Animation**: Built-in clock controls for temporal data
- **Camera Persistence**: Automatically saves/restores camera position
- **Layer Management**: Multiple configurable layers with visibility controls
- **Zustand Integration**: Follows SQLRooms slice pattern for state management

## Installation

```bash
pnpm add @sqlrooms/cesium cesium resium vite-plugin-cesium
```

## Quick Start

### 1. Set up Vite configuration

```typescript
// vite.config.ts
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [react(), cesium()],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  optimizeDeps: {
    include: ['cesium'],
  },
});
```

### 2. Import Cesium CSS and set Ion token

```typescript
// main.tsx
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {Ion} from 'cesium';

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';
```

### 3. Create room store with Cesium slice

```typescript
// store.ts
import {createRoomStore, createRoomShellSlice} from '@sqlrooms/room-shell';
import {
  createCesiumSlice,
  CesiumPanel,
  createDefaultCesiumConfig,
} from '@sqlrooms/cesium';
import {Globe} from 'lucide-react';

export type RoomState = RoomShellSliceState & CesiumSliceState;

const cesiumConfig = createDefaultCesiumConfig();
cesiumConfig.cesium.layers = [
  {
    id: 'my-data',
    type: 'sql-entities',
    visible: true,
    sqlQuery: 'SELECT longitude, latitude, name FROM my_table',
    columnMapping: {
      longitude: 'longitude',
      latitude: 'latitude',
      label: 'name',
    },
  },
];

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        title: 'My Cesium App',
        dataSources: [
          {tableName: 'my_table', type: 'url', url: 'data.parquet'},
        ],
      },
      layout: {
        panels: {
          'cesium-globe': {
            title: '3D Globe',
            icon: Globe,
            component: CesiumPanel,
            placement: 'main',
          },
        },
      },
    })(set, get, store),
    ...createCesiumSlice(cesiumConfig)(set, get, store),
  }),
);
```

### 4. Render the app

```typescript
// App.tsx
import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider} from '@sqlrooms/ui';
import {roomStore} from './store';

export const App = () => (
  <ThemeProvider defaultTheme="dark">
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.LayoutComposer />
    </RoomShell>
  </ThemeProvider>
);
```

## Configuration

### Camera Position

```typescript
cesiumConfig.cesium.camera = {
  longitude: -122.4194, // San Francisco
  latitude: 37.7749,
  height: 1000000, // meters above ellipsoid
  heading: 0, // radians
  pitch: -Math.PI / 2, // looking down
  roll: 0,
};
```

### Clock/Timeline

```typescript
cesiumConfig.cesium.clock = {
  startTime: '2024-01-01T00:00:00Z',
  stopTime: '2024-12-31T23:59:59Z',
  currentTime: '2024-06-01T00:00:00Z',
  multiplier: 86400, // 1 day per second
  shouldAnimate: false,
  clockRange: 'LOOP_STOP',
};
```

### Layer Types

**SQL Entities** (query results as entities):

```typescript
{
  id: 'earthquakes',
  type: 'sql-entities',
  sqlQuery: 'SELECT lat, lon, mag, time FROM earthquakes',
  columnMapping: {
    longitude: 'lon',
    latitude: 'lat',
    size: 'mag',
    time: 'time',
  },
}
```

## API Reference

### Components

- `CesiumPanel` - Main panel component for layout registration
- `CesiumViewerWrapper` - Resium viewer with lifecycle management
- `CesiumEntityLayer` - SQL → entities bridge component
- `CesiumToolbar` - Camera and layer controls
- `CesiumClock` - Clock/timeline controls

### Hooks

- `useCesiumViewer()` - Access viewer instance
- `useSqlToCesiumEntities(rows, config)` - Convert SQL results to entities
- `useClockSync()` - Bidirectional clock synchronization
- `useStoreWithCesium(selector)` - Type-safe store access

### State Actions

- `setViewer(viewer)` - Set viewer instance
- `saveCameraPosition()` - Persist current camera
- `flyTo(lon, lat, height)` - Fly to location
- `zoomToFit()` - Fit view to entities
- `toggleAnimation()` - Play/pause clock
- `addLayer(layer)` / `removeLayer(id)` - Layer management

## DuckDB Spatial Integration

Load the spatial extension for advanced queries:

```sql
INSTALL spatial;
LOAD spatial;

-- Extract coordinates from geometry
SELECT ST_X(geom) AS longitude, ST_Y(geom) AS latitude FROM regions;

-- GeoJSON export
SELECT ST_AsGeoJSON(geom) FROM boundaries;
```

## Performance Tips

- Use `useMemo` when converting data to prevent entity recreation
- Start with <10k entities; optimize with primitives if needed
- Granular Zustand selectors prevent unnecessary re-renders
- Clock sync is throttled to 2Hz (good for 60fps animation)

## Examples

See `examples/cesium/` for a complete working example with flight visualization.

## License

MIT
