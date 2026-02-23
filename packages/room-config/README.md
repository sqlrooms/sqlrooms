# @sqlrooms/room-config

Core Zod schemas and types for persisted Room configuration.

Use this package when you need to validate, type, or serialize the persisted configuration portion of a SQLRooms app.

## Installation

```bash
npm install @sqlrooms/room-config
```

## Main exports

- `BaseRoomConfig`, `createDefaultBaseRoomConfig()`, `DEFAULT_ROOM_TITLE`
- data source schemas: `DataSource`, `FileDataSource`, `UrlDataSource`, `SqlQueryDataSource`
- data source type guards: `isFileDataSource`, `isUrlDataSource`, `isSqlQueryDataSource`
- file load option schemas/types (`LoadFileOptions`, `StandardLoadFileOptions`, etc.)
- layout schema re-exports from `@sqlrooms/layout-config`

## Basic usage

### Validate room config

```ts
import {BaseRoomConfig} from '@sqlrooms/room-config';

const roomConfig = BaseRoomConfig.parse({
  title: 'Earthquakes Explorer',
  description: 'Browser-based analytics app',
  dataSources: [
    {
      type: 'url',
      tableName: 'earthquakes',
      url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
    },
    {
      type: 'sql',
      tableName: 'top_quakes',
      sqlQuery: 'SELECT * FROM earthquakes ORDER BY Magnitude DESC LIMIT 100',
    },
  ],
});
```

### Create defaults

```ts
import {createDefaultBaseRoomConfig} from '@sqlrooms/room-config';

const defaultConfig = createDefaultBaseRoomConfig();
```

## Use with persistence

```ts
import {BaseRoomConfig, LayoutConfig} from '@sqlrooms/room-config';
import {
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
} from '@sqlrooms/room-shell';

const persistence = {
  name: 'my-room-storage',
  sliceConfigSchemas: {
    room: BaseRoomConfig,
    layout: LayoutConfig,
  },
};

const {roomStore} = createRoomStore(
  persistSliceConfigs(persistence, (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        title: 'My Room',
        dataSources: [],
      },
    })(set, get, store),
  })),
);
```
