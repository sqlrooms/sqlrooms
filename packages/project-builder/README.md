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

```tsx
import {
  useBaseProjectStore,
  createProjectSlice,
  createProjectStore,
} from '@sqlrooms/project-builder';

// Create a custom project slice
const createMyFeatureSlice = createProjectSlice((set, get) => ({
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

// Create a project store with custom slices
const useProjectStore = createProjectStore({
  myFeature: createMyFeatureSlice,
});

// Use the store in a component
function MyComponent() {
  const {myFeatureData, addItem} = useProjectStore();

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

### Managing Data Sources

```tsx
import {
  FileDataSourcesPanel,
  TablesListPanel,
  processDroppedFiles,
} from '@sqlrooms/project-builder';

function DataSourcesSection() {
  const handleFileDrop = async (files) => {
    await processDroppedFiles(files);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <FileDataSourcesPanel onFileDrop={handleFileDrop} />
      <TablesListPanel />
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

## Advanced Features

- **Custom State Slices**: Extend the project state with custom slices
- **Task Management**: Built-in task progress tracking
- **Panel Configuration**: Configure and arrange panels dynamically
- **Data Source Integration**: Connect to various data sources
- **File Processing**: Process and transform data files

For more information, visit the SQLRooms documentation.
