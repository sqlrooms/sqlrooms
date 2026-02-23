# @sqlrooms/kepler-config

Zod schemas for persisted Kepler slice state used by `@sqlrooms/kepler`.

## Installation

```bash
npm install @sqlrooms/kepler-config
```

## Exports

- `KeplerMapSchema`
- `KeplerSliceConfig`

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
