A powerful framework for building and managing data projects in SQLRooms. This package provides components and utilities for creating, configuring, and managing data projects with an intuitive user interface.

## Features

- 🏗️ **Project Structure**: Tools for defining and managing project structure
- 📊 **Data Sources**: Components for connecting to and managing data sources
- 🧩 **Panel System**: Flexible panel-based UI for project components
- 🔄 **State Management**: Robust state management using Zustand
- 📁 **File Handling**: Utilities for processing and managing project files
- 🧰 **Extensible Architecture**: Easily extend with custom components and panels

## Installation

```bash
npm install @sqlrooms/project-builder
# or
yarn add @sqlrooms/project-builder
```

## Basic Usage

### Creating a Project Builder

```tsx
import {
  ProjectBuilder,
  ProjectBuilderProvider,
} from '@sqlrooms/project-builder';

function MyApp() {
  return (
    <ProjectBuilderProvider>
      <ProjectBuilder>{/* Your project components */}</ProjectBuilder>
    </ProjectBuilderProvider>
  );
}
```

### Working with Project State

The project-builder package uses Zustand for state management. You can create a custom store with project-specific state and actions.

```tsx
import {
  createProjectSlice,
  createProjectStore,
  ProjectState,
  BaseProjectConfig,
} from '@sqlrooms/project-builder';
import {z} from 'zod';

// Define your custom config schema (optional)
const MyAppConfig = BaseProjectConfig.extend({
  myCustomSetting: z.string().default('default value'),
});
type MyAppConfig = z.infer<typeof MyAppConfig>;

// Define your custom app state
type MyAppState = ProjectState<MyAppConfig> & {
  myFeatureData: any[];
  addItem: (item: any) => void;
  removeItem: (id: string) => void;
};

// Create a project store with custom state
export const {projectStore, useProjectStore} = createProjectStore<
  MyAppConfig,
  MyAppState
>((set, get, store) => ({
  // Base project slice with initial configuration
  ...createProjectSlice<MyAppConfig>({
    config: {
      title: 'My Project',
      layout: {
        /* layout configuration */
      },
      dataSources: [],
      myCustomSetting: 'custom value',
    },
    project: {
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
  const myFeatureData = useProjectStore((state) => state.myFeatureData);
  const addItem = useProjectStore((state) => state.addItem);

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

### Persisting Project Configuration

The project configuration is designed to be persisted between sessions. You can use Zustand's persist middleware to save the configuration to localStorage or any other storage:

```tsx
import {persist} from 'zustand/middleware';
import {
  createProjectSlice,
  createProjectStore,
  ProjectState,
  BaseProjectConfig,
} from '@sqlrooms/project-builder';
import {z} from 'zod';

// Define your custom config schema
const MyAppConfig = BaseProjectConfig.extend({
  myCustomSetting: z.string().default('default value'),
});
type MyAppConfig = z.infer<typeof MyAppConfig>;

// Define your custom app state
type MyAppState = ProjectState<MyAppConfig> & {
  myFeatureData: any[];
  addItem: (item: any) => void;
};

// Create a store with persistence
export const {projectStore, useProjectStore} = createProjectStore<
  MyAppConfig,
  MyAppState
>(
  persist(
    (set, get, store) => ({
      // Base project slice
      ...createProjectSlice<MyAppConfig>({
        config: {
          title: 'My Project',
          layout: {
            /* layout configuration */
          },
          dataSources: [],
          myCustomSetting: 'custom value',
        },
        project: {
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
      name: 'my-project-storage',
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
  createProjectSlice,
  createProjectStore,
  ProjectState,
} from '@sqlrooms/project-builder';
import {createMyFeatureSlice, MyFeatureState} from './myFeatureSlice';
import {
  createAnotherFeatureSlice,
  AnotherFeatureState,
} from './anotherFeatureSlice';

// Combined app state type
type AppState = ProjectState<MyAppConfig> &
  MyFeatureState &
  AnotherFeatureState;

// Create a store with multiple slices
export const {projectStore, useProjectStore} = createProjectStore<
  MyAppConfig,
  AppState
>((set, get, store) => ({
  // Base project slice
  ...createProjectSlice<MyAppConfig>({
    config: {
      /* initial config */
    },
    project: {
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
} from '@sqlrooms/project-builder';

function DataSourcesSection() {
  // Use selectors for better performance
  const addDataSource = useProjectStore((state) => state.project.addDataSource);
  const addProjectFile = useProjectStore(
    (state) => state.project.addProjectFile,
  );

  const handleFileDrop = async (files) => {
    for (const file of files) {
      await addProjectFile(file);
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
import {
  ProjectBuilderPanel,
  ProjectBuilderPanelHeader,
} from '@sqlrooms/project-builder';

function CustomPanel({title, children}) {
  return (
    <ProjectBuilderPanel>
      <ProjectBuilderPanelHeader title={title} />
      <div className="p-4">{children}</div>
    </ProjectBuilderPanel>
  );
}
```

## ProjectStore API Reference

The ProjectStore is the core of the project-builder package. It provides a comprehensive set of properties and methods for managing project state.

### State Properties

#### `config`

The project configuration, which can be persisted between sessions.

```tsx
const config = useProjectStore((state) => state.config);
console.log(config.title); // Access project title
```

#### `schema`

The database schema name used for the project.

```tsx
const schema = useProjectStore((state) => state.project.schema);
```

#### `tasksProgress`

A record of task progress information, useful for displaying loading indicators.

```tsx
const tasksProgress = useProjectStore((state) => state.project.tasksProgress);
// Example: { "init-db": { message: "Initializing database...", progress: 0.5 } }
```

#### `projectId`

The unique identifier for the project, undefined for new projects.

```tsx
const projectId = useProjectStore((state) => state.project.projectId);
```

#### `panels`

A record of panel information, including title, icon, component, and placement.

```tsx
const panels = useProjectStore((state) => state.project.panels);
// Example: { "data-sources": { title: "Data Sources", icon: DatabaseIcon, ... } }
```

#### `isReadOnly`

Whether the project is in read-only mode.

```tsx
const isReadOnly = useProjectStore((state) => state.project.isReadOnly);
```

#### `tables`

An array of data tables available in the project.

```tsx
const tables = useProjectStore((state) => state.project.tables);
// Access table schemas and metadata
```

#### `projectFiles`

An array of project file information.

```tsx
const projectFiles = useProjectStore((state) => state.project.projectFiles);
```

#### `projectFilesProgress`

A record of file processing progress information.

```tsx
const projectFilesProgress = useProjectStore(
  (state) => state.project.projectFilesProgress,
);
```

#### `lastSavedConfig`

The last saved project configuration, used to check for unsaved changes.

```tsx
const lastSavedConfig = useProjectStore(
  (state) => state.project.lastSavedConfig,
);
```

#### `initialized`

Whether the project has been initialized.

```tsx
const initialized = useProjectStore((state) => state.project.initialized);
```

#### `isDataAvailable`

Whether the project data has been loaded.

```tsx
const isDataAvailable = useProjectStore(
  (state) => state.project.isDataAvailable,
);
```

#### `dataSourceStates`

A record of data source states by table name.

```tsx
const dataSourceStates = useProjectStore(
  (state) => state.project.dataSourceStates,
);
```

#### `tableRowCounts`

A record of row counts by table name.

```tsx
const tableRowCounts = useProjectStore((state) => state.project.tableRowCounts);
```

### Methods

#### `initialize()`

Initialize the project state.

```tsx
const initialize = useProjectStore((state) => state.project.initialize);
await initialize();
```

#### `setTaskProgress(id, taskProgress)`

Set the progress of a task.

```tsx
const setTaskProgress = useProjectStore(
  (state) => state.project.setTaskProgress,
);
setTaskProgress('my-task', {message: 'Processing...', progress: 0.5});
```

#### `getLoadingProgress()`

Get the current loading progress.

```tsx
const getLoadingProgress = useProjectStore(
  (state) => state.project.getLoadingProgress,
);
const progress = getLoadingProgress();
```

#### `setProjectConfig(config)`

Set the project configuration.

```tsx
const setProjectConfig = useProjectStore(
  (state) => state.project.setProjectConfig,
);
const config = useProjectStore((state) => state.config);
setProjectConfig({...config, title: 'New Title'});
```

#### `setLastSavedConfig(config)`

Set the last saved project configuration.

```tsx
const setLastSavedConfig = useProjectStore(
  (state) => state.project.setLastSavedConfig,
);
const config = useProjectStore((state) => state.config);
setLastSavedConfig(config);
```

#### `hasUnsavedChanges()`

Check if the project has unsaved changes.

```tsx
const hasUnsavedChanges = useProjectStore(
  (state) => state.project.hasUnsavedChanges,
);
if (hasUnsavedChanges()) {
  // Prompt user to save changes
}
```

#### `setLayout(layout)`

Set the project layout configuration.

```tsx
const setLayout = useProjectStore((state) => state.project.setLayout);
setLayout(newLayout);
```

#### `togglePanel(panel, show)`

Toggle the visibility of a panel.

```tsx
const togglePanel = useProjectStore((state) => state.project.togglePanel);
togglePanel('data-sources', true); // Show the data sources panel
```

#### `togglePanelPin(panel)`

Toggle the pin state of a panel.

```tsx
const togglePanelPin = useProjectStore((state) => state.project.togglePanelPin);
togglePanelPin('data-sources');
```

#### `addOrUpdateSqlQueryDataSource(tableName, query, oldTableName)`

Add or update a SQL query data source.

```tsx
const addOrUpdateSqlQueryDataSource = useProjectStore(
  (state) => state.project.addOrUpdateSqlQueryDataSource,
);
await addOrUpdateSqlQueryDataSource(
  'filtered_data',
  'SELECT * FROM data WHERE value > 10',
);
```

#### `removeSqlQueryDataSource(tableName)`

Remove a SQL query data source.

```tsx
const removeSqlQueryDataSource = useProjectStore(
  (state) => state.project.removeSqlQueryDataSource,
);
await removeSqlQueryDataSource('filtered_data');
```

#### `addProjectFile(info, desiredTableName)`

Add a project file.

```tsx
const addProjectFile = useProjectStore((state) => state.project.addProjectFile);
const dataTable = await addProjectFile(file, 'my_data');
```

#### `removeProjectFile(pathname)`

Remove a project file.

```tsx
const removeProjectFile = useProjectStore(
  (state) => state.project.removeProjectFile,
);
removeProjectFile('/path/to/file.csv');
```

#### `maybeDownloadDataSources()`

Download data sources if needed.

```tsx
const maybeDownloadDataSources = useProjectStore(
  (state) => state.project.maybeDownloadDataSources,
);
await maybeDownloadDataSources();
```

#### `setProjectFiles(info)`

Set the project files.

```tsx
const setProjectFiles = useProjectStore(
  (state) => state.project.setProjectFiles,
);
setProjectFiles(fileInfoArray);
```

#### `setProjectFileProgress(pathname, fileState)`

Set the progress of a project file.

```tsx
const setProjectFileProgress = useProjectStore(
  (state) => state.project.setProjectFileProgress,
);
setProjectFileProgress('/path/to/file.csv', {status: 'processing'});
```

#### `addTable(tableName, data)`

Add a table to the project.

```tsx
const addTable = useProjectStore((state) => state.project.addTable);
await addTable('my_table', records);
```

#### `addDataSource(dataSource, status)`

Add a data source to the project.

```tsx
const addDataSource = useProjectStore((state) => state.project.addDataSource);
await addDataSource({
  type: 'url',
  url: 'https://example.com/data.csv',
  tableName: 'external_data',
});
```

#### `getTable(tableName)`

Get a table by name.

```tsx
const getTable = useProjectStore((state) => state.project.getTable);
const table = getTable('my_table');
```

#### `setTables(dataTable)`

Set the project tables.

```tsx
const setTables = useProjectStore((state) => state.project.setTables);
await setTables(tableArray);
```

#### `setTableRowCount(tableName, rowCount)`

Set the row count for a table.

```tsx
const setTableRowCount = useProjectStore(
  (state) => state.project.setTableRowCount,
);
setTableRowCount('my_table', 1000);
```

#### `setProjectTitle(title)`

Set the project title.

```tsx
const setProjectTitle = useProjectStore(
  (state) => state.project.setProjectTitle,
);
setProjectTitle('My Awesome Project');
```

#### `setDescription(description)`

Set the project description.

```tsx
const setDescription = useProjectStore((state) => state.project.setDescription);
setDescription('This is a description of my project');
```

#### `areDatasetsReady()`

Check if all datasets are ready.

```tsx
const areDatasetsReady = useProjectStore(
  (state) => state.project.areDatasetsReady,
);
if (areDatasetsReady()) {
  // Proceed with data operations
}
```

#### `findTableByName(tableName)`

Find a table by name.

```tsx
const findTableByName = useProjectStore(
  (state) => state.project.findTableByName,
);
const table = findTableByName('my_table');
```

#### `updateReadyDataSources()`

Update the status of all data sources based on the current tables.

```tsx
const updateReadyDataSources = useProjectStore(
  (state) => state.project.updateReadyDataSources,
);
await updateReadyDataSources();
```

#### `onDataUpdated()`

Called when data has been updated.

```tsx
const onDataUpdated = useProjectStore((state) => state.project.onDataUpdated);
await onDataUpdated();
```

#### `areViewsReadyToRender()`

Check if views are ready to render.

```tsx
const areViewsReadyToRender = useProjectStore(
  (state) => state.project.areViewsReadyToRender,
);
if (areViewsReadyToRender()) {
  // Render views
}
```

#### `refreshTableSchemas()`

Refresh table schemas from the database.

```tsx
const refreshTableSchemas = useProjectStore(
  (state) => state.project.refreshTableSchemas,
);
const updatedTables = await refreshTableSchemas();
```

## Advanced Features

- **Custom State Slices**: Extend the project state with custom slices
- **Task Management**: Built-in task progress tracking
- **Panel Configuration**: Configure and arrange panels dynamically
- **Data Source Integration**: Connect to various data sources
- **File Processing**: Process and transform data files

For more information, visit the SQLRooms documentation.

```

```
