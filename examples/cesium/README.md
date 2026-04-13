# Cesium Flights Explorer

A 3D globe visualization of OpenSky flight traffic using Cesium and SQLRooms.

## Features

- **3D Globe**: Interactive Cesium-powered 3D globe
- **OpenSky Flights**: Global flight playback from local parquet extracts
- **Time Animation**: Animate a day of flight traffic with clock controls
- **SQL Queries**: Flight summaries and point samples loaded through DuckDB
- **Camera Persistence**: Camera position saved across page reloads

## Setup

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Use the hosted OpenSky parquet files**:

   By default the example loads:
   - `https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/opensky_flights_cesium_mosaic_sampled_every10th.parquet`
   - `https://pub-334685c2155547fab4287d84cae47083.r2.dev/opensky/opensky_flight_points_cesium_sampled_every10th.parquet`

   You can override them with `VITE_OPENSKY_FLIGHTS_URL` and
   `VITE_OPENSKY_POINTS_URL`.

3. **Run development server**:
   ```bash
   pnpm dev
   ```

## Usage

### Camera Controls

- **Left-click + drag**: Rotate globe
- **Right-click + drag**: Pan camera
- **Scroll wheel**: Zoom in/out
- **Fit View button**: Zoom to the sampled global flight set

### Timeline Controls

- **Play/Pause**: Start/stop time animation
- **Speed slider**: Adjust animation speed on a logarithmic scale from 1x up to 1 year/second
- **Timeline**: Scrub through time range

### Layers

- **Eye icon**: Toggle layer visibility

## Data Sources

- `opensky_flights`: per-flight summary rows for SQL exploration
- `opensky_flight_points`: sampled track points used by the Cesium layer
- flights are rendered as tinted airplane billboards, colored by altitude band

## Architecture

This example demonstrates:

- Cesium slice integration with room store
- SQL-based entity layers (`sql-entities` type)
- Using local parquet files through Vite's `/@fs` dev route
- Clock configuration for time-dynamic data
- Camera persistence via Zod schemas
- Vite configuration for Cesium assets and local data access

## Customization

### Change The Cesium Query

Edit `src/store.ts` to modify the SQL query:

```typescript
sqlQuery: `
  SELECT longitude, latitude, altitude_m AS altitude
  FROM opensky_flight_points
  WHERE duration_s >= 3600
`;
```

### Add Layers

```typescript
cesiumConfig.cesium.layers.push({
  id: 'my-layer',
  type: 'sql-entities',
  visible: true,
  sqlQuery: 'SELECT * FROM opensky_flight_points',
  columnMapping: {
    longitude: 'longitude',
    latitude: 'latitude',
    altitude: 'altitude_m',
    time: 'point_time_utc',
  },
});
```

### Adjust Camera

```typescript
cesiumConfig.cesium.camera = {
  longitude: 139.769, // Tokyo
  latitude: 35.6804,
  height: 5000000,
};
```

## Troubleshooting

### Globe not rendering

- Check browser console for errors
- Verify the local parquet files exist at the configured paths
- Ensure Vite plugin copied assets correctly

### No flight data

- Check the `/@fs/...` parquet requests in the network tab
- Verify DuckDB loaded successfully
- Check browser console for SQL errors

### Timeline/animation broken

- Ensure `widgets.css` is imported in `main.tsx`
- Check clock configuration in store

## Learn More

- [Cesium Documentation](https://cesium.com/learn/)
- [SQLRooms Documentation](../../docs/)
- [OpenSky Scientific Datasets](https://opensky-network.org/data/scientific)
