# Cesium Earthquake Explorer

A 3D globe visualization of global earthquake data using Cesium and SQLRooms.

## Features

- **3D Globe**: Interactive Cesium-powered 3D globe
- **Earthquake Data**: Real-time visualization of earthquakes magnitude 5.0+
- **Time Animation**: Animate through earthquake timeline with clock controls
- **SQL Queries**: Data loaded from DuckDB via SQL queries
- **Camera Persistence**: Camera position saved across page reloads

## Setup

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Set Cesium Ion token** (required for imagery):

   ```bash
   cp .env.example .env
   # Edit .env and add your token from https://ion.cesium.com/tokens
   ```

3. **Run development server**:
   ```bash
   pnpm dev
   ```

## Usage

### Camera Controls

- **Left-click + drag**: Rotate globe
- **Right-click + drag**: Pan camera
- **Scroll wheel**: Zoom in/out
- **Fit View button**: Zoom to all earthquakes

### Timeline Controls

- **Play/Pause**: Start/stop time animation
- **Speed slider**: Adjust animation speed on a logarithmic scale from 1x up to 1 year/second
- **Timeline**: Scrub through time range

### Layers

- **Eye icon**: Toggle layer visibility

## Data Source

Earthquake data from USGS via Hugging Face:
https://huggingface.co/datasets/sqlrooms/earthquakes

## Architecture

This example demonstrates:

- Cesium slice integration with room store
- SQL-based entity layers (`sql-entities` type)
- Clock configuration for time-dynamic data
- Camera persistence via Zod schemas
- Vite configuration for Cesium assets

## Customization

### Change Data Query

Edit `src/store.ts` to modify the SQL query:

```typescript
sqlQuery: `
  SELECT latitude, longitude, mag, place
  FROM earthquakes
  WHERE mag > 5.0  -- Larger earthquakes only
`;
```

### Add Layers

```typescript
cesiumConfig.cesium.layers.push({
  id: 'my-layer',
  type: 'sql-entities',
  visible: true,
  sqlQuery: 'SELECT * FROM my_table',
  columnMapping: {
    longitude: 'lon',
    latitude: 'lat',
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
- Verify Cesium Ion token is set in `.env`
- Ensure Vite plugin copied assets correctly

### No earthquake data

- Check network tab for parquet file download
- Verify DuckDB loaded successfully
- Check browser console for SQL errors

### Timeline/animation broken

- Ensure `widgets.css` is imported in `main.tsx`
- Check clock configuration in store

## Learn More

- [Cesium Documentation](https://cesium.com/learn/)
- [SQLRooms Documentation](../../docs/)
- [DuckDB Spatial Extension](https://duckdb.org/docs/extensions/spatial.html)
