`@sqlrooms/artifacts` provides a lightweight room-store slice for tracking
workspace artifacts such as dashboards, notebooks, canvas documents, and apps.

It is intentionally limited to artifact metadata and selection:

- artifact identity (`id`)
- artifact type (`type`)
- display title (`title`)
- artifact ordering
- current selected artifact

It does not own layout/open-tab state or artifact-specific runtime data.

## Installation

```ts
import {
  ArtifactsSliceConfig,
  createArtifactsSlice,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
```

## Usage

```ts
const store = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'my-room',
      sliceConfigSchemas: {
        artifacts: ArtifactsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createArtifactsSlice()(set, get, store),
    }),
  ),
);
```

## API

- `artifacts.addItem({type, title, id?})`
- `artifacts.ensureItem(id, {type, title})`
- `artifacts.renameItem(id, title)`
- `artifacts.removeItem(id)`
- `artifacts.setCurrentItem(id?)`
- `artifacts.setOrder(order)`
- `artifacts.getItem(id)`

Use a separate slice for layout/open tabs and domain-specific content.
