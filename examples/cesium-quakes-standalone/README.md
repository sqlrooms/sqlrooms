# Wadati–Benioff Explorer (standalone)

A 3D globe visualization of global seismicity rendered at true depth, with
camera presets that cut textbook cross-sections through the world's
subduction zones.

**Self-contained example.** Cesium + sqlrooms glue code (viewer lifecycle,
slice, hooks, panel components) lives in [src/cesium/](src/cesium/) rather
than a workspace package, so anyone can copy this directory to their own
project and adapt it without pulling in additional sqlrooms internals.

## Features

- **3D depth-aware globe**: Every event renders at `(lon, lat, -depth_m)`
  inside the Earth; `depthTestAgainstTerrain: true` on the viewer means the
  globe occludes subsurface events until a preset's section-cut clipping
  plane exposes them. Events are colored by magnitude band and sized by
  recency
- **Subduction zone presets**: One click flies the camera to Tonga, Japan,
  Chile, Indonesia, Cascadia, or the Hellenic arc with an along-strike view
- **Slab slicer**: Activating a preset rewrites the layer's SQL so only
  events within ±50 km of the section line remain, revealing the
  Wadati–Benioff zone as a curving line of seismicity descending to ~700 km
- **Parametric slab surface**: A translucent triangle mesh of the
  subducting slab top is drawn underneath the seismicity, generated from a
  per-zone analytical dip profile loosely tuned to Slab2.0 (Hayes et al.,
  2018). Each preset has its own character — Cascadia stays nearly flat,
  Tonga plunges to 700 km
- **Mag-vs-depth histogram**: Live stacked histogram of the visible slab,
  showing the bimodal shallow-plus-deep distribution as the time slider is
  scrubbed
- **Time animation**: Cesium clock + timeline controls for scrubbing through
  the catalog
- **Camera persistence**: Manual camera position saved across page reloads

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
- **Speed slider**: Adjust animation speed (0.1x to 100x)
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
