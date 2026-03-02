Zod schemas for persisted Kepler slice state used by `@sqlrooms/kepler`.

## Installation

```bash
npm install @sqlrooms/kepler-config
```

## Exports

- `KeplerMapSchema`
- `KeplerSliceConfig`

`KeplerSliceConfig` is the top-level container schema for persisted Kepler state
(including multiple maps). Use `KeplerMapSchema` when constructing or validating
each individual map object inside that container (for example: layers,
datasource bindings, and viewport settings).

## Usage

Use these schemas when validating or persisting Kepler state:

```ts
import {KeplerSliceConfig} from '@sqlrooms/kepler-config';

const parsed = KeplerSliceConfig.parse(rawKeplerConfig);
```

Example with SQLRooms persistence:

```ts
import {KeplerSliceConfig} from '@sqlrooms/kepler-config';
import {createRoomStore, persistSliceConfigs} from '@sqlrooms/room-shell';

const persistence = {
  name: 'my-app-storage',
  sliceConfigSchemas: {
    kepler: KeplerSliceConfig,
  },
};

createRoomStore(
  persistSliceConfigs(persistence, (set, get, store) => ({
    // ...your slices here
  })),
);
```

## Related package

- `@sqlrooms/kepler` for runtime Kepler slice and React components
