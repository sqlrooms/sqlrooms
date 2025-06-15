A powerful framework for building and managing data rooms in SQLRooms. This package provides components and utilities for creating, configuring, and managing data rooms with an intuitive user interface.

## Features

- 🏗️ **Room Structure**: Tools for defining and managing room structure
- 📊 **Data Sources**: Components for connecting to and managing data sources
- 🧩 **Panel System**: Flexible panel-based UI for room components
- 🔄 **State Management**: Robust state management using Zustand
- 📁 **File Handling**: Utilities for processing and managing room files
- 🧰 **Extensible Architecture**: Easily extend with custom components and panels

## Installation

```bash
npm install @sqlrooms/room-shell
# or
yarn add @sqlrooms/room-shell
```

## Basic Usage

### Creating a Room Builder

```tsx
import {RoomShell} from '@sqlrooms/room-shell';

function MyApp() {
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar />
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  );
}
```

### Working with Room State

The room-shell package uses Zustand for state management. You can create a custom store with room-specific state and actions.

```tsx
import {
  createRoomSlice,
  createRoomStore,
  RoomState,
  BaseRoomConfig,
} from '@sqlrooms/room-shell';
import {z} from 'zod';

// Define your custom config schema (optional)
const MyRoomConfig = BaseRoomConfig.extend({
  myCustomSetting: z.string().default('default value'),
});
type MyRoomConfig = z.infer<typeof MyRoomConfig>;

// Define your custom app state
type MyRoomState = RoomState<MyRoomConfig> & {
  myFeatureData: any[];
  addItem: (item: any) => void;
  removeItem: (id: string) => void;
};

// Create a room store with custom state
export const {roomStore, useRoomStore} = createRoomStore<
  MyRoomConfig,
  MyRoomState
>((set, get, store) => ({
  // Base room slice with initial configuration
  ...createRoomSlice<MyRoomConfig>({
    config: {
      title: 'My Room',
      layout: {
        /* layout configuration */
      },
      dataSources: [],
      myCustomSetting: 'custom value',
    },
    room: {
      panels: {
        /* panel definitions */
      },
    },
  })(set, get, store),

  // Custom state and actions
  myFeatureData: [],
  addItem: (item) =>
    set((state) => ({
      myFeatureData: [...state.myFeatureData, item],
    })),
  removeItem: (id) =>
    set((state) => ({
      myFeatureData: state.myFeatureData.filter((item) => item.id !== id),
    })),
}));

// Use the store in a component with selector for better performance
function MyComponent() {
  // Use selectors for better performance
  const myFeatureData = useRoomStore((state) => state.myFeatureData);
  const addItem = useRoomStore((state) => state.addItem);

  return (
    <div>
      <h2>My Items ({myFeatureData.length})</h2>
      <button onClick={() => addItem({id: Date.now(), name: 'New Item'})}>
        Add Item
      </button>
      {/* Render items */}
    </div>
  );
}
```

### Persisting Room Configuration

The room configuration is designed to be persisted between sessions. You can use Zustand's persist middleware to save the configuration to localStorage or any other storage:

```tsx
import {persist} from 'zustand/middleware';
import {
  createRoomSlice,
  createRoomStore,
  RoomState,
  BaseRoomConfig,
} from '@sqlrooms/room-shell';
import {z} from 'zod';

// Define your custom config schema
const MyRoomConfig = BaseRoomConfig.extend({
  myCustomSetting: z.string().default('default value'),
});
type MyRoomConfig = z.infer<typeof MyRoomConfig>;

// Define your custom app state
type MyRoomState = RoomState<MyRoomConfig> & {
  myFeatureData: any[];
  addItem: (item: any) => void;
};

// Create a store with persistence
export const {roomStore, useRoomStore} = createRoomStore<
  MyRoomConfig,
  MyRoomState
>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomSlice<MyRoomConfig>({
        config: {
          title: 'My Room',
          layout: {
            /* layout configuration */
          },
          dataSources: [],
          myCustomSetting: 'custom value',
        },
        room: {
          panels: {
            /* panel definitions */
          },
        },
      })(set, get, store),

      // Custom state and actions
      myFeatureData: [],
      addItem: (item) =>
        set((state) => ({
          myFeatureData: [...state.myFeatureData, item],
        })),
    }),
    {
      name: 'my-room-storage',
      partialize: (state) => ({
        // Persist only the config part of the state
        config: state.config,
      }),
    },
  ),
);
```

### Integrating Multiple Feature Slices

For larger applications, you can organize your state into feature slices:

```tsx
import {
  createRoomSlice,
  createRoomStore,
  RoomState,
} from '@sqlrooms/room-shell';
import {createMyFeatureSlice, MyFeatureState} from './myFeatureSlice';
import {
  createAnotherFeatureSlice,
  AnotherFeatureState,
} from './anotherFeatureSlice';

// Combined app state type
type RoomState = RoomState<MyRoomConfig> & MyFeatureState & AnotherFeatureState;

// Create a store with multiple slices
export const {roomStore, useRoomStore} = createRoomStore<
  MyRoomConfig,
  RoomState
>((set, get, store) => ({
  // Base room slice
  ...createRoomSlice<MyRoomConfig>({
    config: {
      /* initial config */
    },
    room: {
      panels: {
        /* panel definitions */
      },
    },
  })(set, get, store),

  // Feature slices
  ...createMyFeatureSlice()(set, get, store),
  ...createAnotherFeatureSlice({
    // Feature-specific options
    customOption: 'value',
  })(set, get, store),
}));
```

### Managing Data Sources

```tsx
import {
  FileDataSourcesPanel,
  TablesListPanel,
  DataSourceType,
} from '@sqlrooms/room-shell';

function DataSourcesSection() {
  // Use selectors for better performance
  const addDataSource = useRoomStore((state) => state.room.addDataSource);
  const addRoomFile = useRoomStore((state) => state.room.addRoomFile);

  const handleFileDrop = async (files) => {
    for (const file of files) {
      await addRoomFile(file);
    }
  };

  const handleAddCsvUrl = (url) => {
    addDataSource({
      type: DataSourceType.url,
      url,
      tableName: 'data_from_url',
    });
  };

  const handleAddSqlQuery = (query) => {
    addDataSource({
      type: DataSourceType.sqlQuery,
      query,
      tableName: 'query_results',
    });
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <FileDataSourcesPanel onFileDrop={handleFileDrop} />
      <TablesListPanel />
      <button onClick={() => handleAddCsvUrl('https://example.com/data.csv')}>
        Add CSV from URL
      </button>
    </div>
  );
}
```

### Creating Custom Panels

```tsx
import {RoomPanel, RoomPanelHeader} from '@sqlrooms/room-shell';

function CustomPanel({title, children}) {
  return (
    <RoomPanel>
      <RoomPanelHeader title={title} />
      <div className="p-4">{children}</div>
    </RoomPanel>
  );
}
```

## RoomStore API Reference

The RoomStore is the core of the room-shell package. It provides a comprehensive set of properties and methods for managing room state.

### State Properties

#### `config`

The room configuration, which can be persisted between sessions.

```tsx
const config = useRoomStore((state) => state.config);
console.log(config.title); // Access room title
```

#### `schema`

The database schema name used for the room.

```tsx
const schema = useRoomStore((state) => state.room.schema);
```

#### `tasksProgress`

A record of task progress information, useful for displaying loading indicators.

```tsx
const tasksProgress = useRoomStore((state) => state.room.tasksProgress);
// Example: { "init-db": { message: "Initializing database...", progress: 0.5 } }
```

#### `roomId`

The unique identifier for the room, undefined for new rooms.

```tsx
const roomId = useRoomStore((state) => state.room.roomId);
```

#### `panels`

A record of panel information, including title, icon, component, and placement.

```tsx
const panels = useRoomStore((state) => state.room.panels);
// Example: { "data-sources": { title: "Data Sources", icon: DatabaseIcon, ... } }
```

#### `isReadOnly`

Whether the room is in read-only mode.

```tsx
const isReadOnly = useRoomStore((state) => state.room.isReadOnly);
```

#### `tables`

An array of data tables available in the room.

```tsx
const tables = useRoomStore((state) => state.room.tables);
// Access table schemas and metadata
```

#### `roomFiles`

An array of room file information.

```tsx
const roomFiles = useRoomStore((state) => state.room.roomFiles);
```

#### `roomFilesProgress`

A record of file processing progress information.

```tsx
const roomFilesProgress = useRoomStore((state) => state.room.roomFilesProgress);
```

#### `lastSavedConfig`

The last saved room configuration, used to check for unsaved changes.

```tsx
const lastSavedConfig = useRoomStore((state) => state.room.lastSavedConfig);
```

#### `initialized`

Whether the room has been initialized.

```tsx
const initialized = useRoomStore((state) => state.room.initialized);
```

#### `isDataAvailable`

Whether the room data has been loaded.

```tsx
const isDataAvailable = useRoomStore((state) => state.room.isDataAvailable);
```

#### `dataSourceStates`

A record of data source states by table name.

```tsx
const dataSourceStates = useRoomStore((state) => state.room.dataSourceStates);
```

#### `tableRowCounts`

A record of row counts by table name.

```tsx
const tableRowCounts = useRoomStore((state) => state.room.tableRowCounts);
```

### Methods

#### `initialize()`

Initialize the room state.

```tsx
const initialize = useRoomStore((state) => state.room.initialize);
await initialize();
```

#### `setTaskProgress(id, taskProgress)`

Set the progress of a task.

```tsx
const setTaskProgress = useRoomStore((state) => state.room.setTaskProgress);
setTaskProgress('my-task', {message: 'Processing...', progress: 0.5});
```

#### `getLoadingProgress()`

Get the current loading progress.

```tsx
const getLoadingProgress = useRoomStore(
  (state) => state.room.getLoadingProgress,
);
const progress = getLoadingProgress();
```

#### `setRoomConfig(config)`

Set the room configuration.

```tsx
const setRoomConfig = useRoomStore((state) => state.room.setRoomConfig);
const config = useRoomStore((state) => state.config);
setRoomConfig({...config, title: 'New Title'});
```

#### `setLastSavedConfig(config)`

Set the last saved room configuration.

```tsx
const setLastSavedConfig = useRoomStore(
  (state) => state.room.setLastSavedConfig,
);
const config = useRoomStore((state) => state.config);
setLastSavedConfig(config);
```

#### `hasUnsavedChanges()`

Check if the room has unsaved changes.

```tsx
const hasUnsavedChanges = useRoomStore((state) => state.room.hasUnsavedChanges);
if (hasUnsavedChanges()) {
  // Prompt user to save changes
}
```

#### `setLayout(layout)`

Set the room layout configuration.

```tsx
const setLayout = useRoomStore((state) => state.room.setLayout);
setLayout(newLayout);
```

#### `togglePanel(panel, show)`

Toggle the visibility of a panel.

```tsx
const togglePanel = useRoomStore((state) => state.room.togglePanel);
togglePanel('data-sources', true); // Show the data sources panel
```

#### `togglePanelPin(panel)`

Toggle the pin state of a panel.

```tsx
const togglePanelPin = useRoomStore((state) => state.room.togglePanelPin);
togglePanelPin('data-sources');
```

#### `addOrUpdateSqlQueryDataSource(tableName, query, oldTableName)`

Add or update a SQL query data source.

```tsx
const addOrUpdateSqlQueryDataSource = useRoomStore(
  (state) => state.room.addOrUpdateSqlQueryDataSource,
);
await addOrUpdateSqlQueryDataSource(
  'filtered_data',
  'SELECT * FROM data WHERE value > 10',
);
```

#### `removeSqlQueryDataSource(tableName)`

Remove a SQL query data source.

```tsx
const removeSqlQueryDataSource = useRoomStore(
  (state) => state.room.removeSqlQueryDataSource,
);
await removeSqlQueryDataSource('filtered_data');
```

#### `addRoomFile(info, desiredTableName)`

Add a room file.

```tsx
const addRoomFile = useRoomStore((state) => state.room.addRoomFile);
const dataTable = await addRoomFile(file, 'my_data');
```

#### `removeRoomFile(pathname)`

Remove a room file.

```tsx
const removeRoomFile = useRoomStore((state) => state.room.removeRoomFile);
removeRoomFile('/path/to/file.csv');
```

#### `maybeDownloadDataSources()`

Download data sources if needed.

```tsx
const maybeDownloadDataSources = useRoomStore(
  (state) => state.room.maybeDownloadDataSources,
);
await maybeDownloadDataSources();
```

#### `setRoomFiles(info)`

Set the room files.

```tsx
const setRoomFiles = useRoomStore((state) => state.room.setRoomFiles);
setRoomFiles(fileInfoArray);
```

#### `setRoomFileProgress(pathname, fileState)`

Set the progress of a room file.

```tsx
const setRoomFileProgress = useRoomStore(
  (state) => state.room.setRoomFileProgress,
);
setRoomFileProgress('/path/to/file.csv', {status: 'processing'});
```

#### `addTable(tableName, data)`

Add a table to the room.

```tsx
const addTable = useRoomStore((state) => state.room.addTable);
await addTable('my_table', records);
```

#### `addDataSource(dataSource, status)`

Add a data source to the room.

```tsx
const addDataSource = useRoomStore((state) => state.room.addDataSource);
await addDataSource({
  type: 'url',
  url: 'https://example.com/data.csv',
  tableName: 'external_data',
});
```

#### `getTable(tableName)`

Get a table by name.

```tsx
const getTable = useRoomStore((state) => state.room.getTable);
const table = getTable('my_table');
```

#### `setTables(dataTable)`

Set the room tables.

```tsx
const setTables = useRoomStore((state) => state.room.setTables);
await setTables(tableArray);
```

#### `setTableRowCount(tableName, rowCount)`

Set the row count for a table.

```tsx
const setTableRowCount = useRoomStore((state) => state.room.setTableRowCount);
setTableRowCount('my_table', 1000);
```

#### `setRoomTitle(title)`

Set the room title.

```tsx
const setRoomTitle = useRoomStore((state) => state.room.setRoomTitle);
setRoomTitle('My Awesome Room');
```

#### `setDescription(description)`

Set the room description.

```tsx
const setDescription = useRoomStore((state) => state.room.setDescription);
setDescription('This is a description of my room');
```

#### `areDatasetsReady()`

Check if all datasets are ready.

```tsx
const areDatasetsReady = useRoomStore((state) => state.room.areDatasetsReady);
if (areDatasetsReady()) {
  // Proceed with data operations
}
```

#### `findTableByName(tableName)`

Find a table by name.

```tsx
const findTableByName = useRoomStore((state) => state.room.findTableByName);
const table = findTableByName('my_table');
```

#### `updateReadyDataSources()`

Update the status of all data sources based on the current tables.

```tsx
const updateReadyDataSources = useRoomStore(
  (state) => state.room.updateReadyDataSources,
);
await updateReadyDataSources();
```

#### `onDataUpdated()`

Called when data has been updated.

```tsx
const onDataUpdated = useRoomStore((state) => state.room.onDataUpdated);
await onDataUpdated();
```

#### `areViewsReadyToRender()`

Check if views are ready to render.

```tsx
const areViewsReadyToRender = useRoomStore(
  (state) => state.room.areViewsReadyToRender,
);
if (areViewsReadyToRender()) {
  // Render views
}
```

#### `refreshTableSchemas()`

Refresh table schemas from the database.

```tsx
const refreshTableSchemas = useRoomStore(
  (state) => state.room.refreshTableSchemas,
);
const updatedTables = await refreshTableSchemas();
```

## Advanced Features

- **Custom State Slices**: Extend the room state with custom slices
- **Task Management**: Built-in task progress tracking
- **Panel Configuration**: Configure and arrange panels dynamically
- **Data Source Integration**: Connect to various data sources
- **File Processing**: Process and transform data files

For more information, visit the SQLRooms documentation.

```

```
