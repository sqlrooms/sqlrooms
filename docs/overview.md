---
outline: deep
---

# What is SQLRooms?

SQLRooms provides a foundation and set of building blocks for creating data analytics applications that run entirely in the browser. It combines essential components like a SQL query engine (DuckDB), data visualization tools, state management, and UI components into a cohesive toolkit, making it significantly easier to create powerful analytics tools without a backend.

<a href="/examples">
  <img src="/media/overview/collage.webp" alt="SQLRooms example apps" width=600>
</a>

## Who is it for?

SQLRooms is designed for developers building:

- Interactive data analysis tools
- Custom BI solutions
- Data visualization applications
- Internal analytics dashboards

## Motivation

Modern data analytics applications face several challenges that SQLRooms addresses:

### Developer Experience

Building analytics applications typically requires integrating multiple complex components. SQLRooms provides a complete foundation with state management, UI components, and extensible architecture out of the box.

### Performance and Scale

DuckDB is purpose-built for analytics, providing fast query performance on large datasets through its columnar engine and optimized query processing. Running in the browser through WebAssembly, each user gets their own instance, enabling automatic scaling without infrastructure costs. Applications can even work offline, as there's no dependency on backend services.

### AI-Powered Analytics

The browser-based DuckDB engine enables powerful AI-driven analytics workflows:

- Interactive AI agents that can write and execute SQL queries
- Automated data analysis and insights generation

Check out our [AI example](/examples#ai-powered-analytics) that demonstrates how to build an AI agent that can analyze your data using natural language, execute SQL queries, and provide insights – all running directly in the browser.

### Privacy and Security

SQLRooms enables applications where sensitive data can remain completely client-side, as all data processing and analysis can be performed directly in the browser using DuckDB. This architecture allows for implementations where data never needs to leave the client, simplifying compliance and security requirements when needed.

## Modular Architecture

SQLRooms is designed with a modular architecture that allows developers to pick and choose exactly the functionality they need for their data analytics applications. This approach enables you to build custom solutions tailored to your specific requirements.

![SQLRooms Architecture](/media/overview/architecture.svg)

### Core Philosophy

The SQLRooms architecture follows these key principles:

1. **Modularity**: Each package has a specific, focused purpose
2. **Composability**: Packages can be combined in various ways to create custom applications
3. **Minimal Dependencies**: Packages only depend on what they absolutely need
4. **Consistent API Design**: All packages follow similar patterns for ease of use
5. **Slice-Based Architecture**: State management uses a composable slice pattern that allows applications to combine functionality from different modules

### Core Components

#### ProjectStore

The central state management system built on Zustand handles:

- Project configuration and persistence
- Data source management
- DuckDB integration
- Type-safe state management

The ProjectStore can be extended with custom configuration and functionality specific to your needs.

#### Project Builder

Provides the application shell with:

- Configurable and pluggable views
- Flexible panel layouts
- Sidebar and main view management

#### Built-in Views

Ready-to-use components accelerate development:

- DataTable View for displaying and interacting with query results
- S3 Browser for managing data sources and importing data
- SQL Query Editor with syntax highlighting

### Package Structure

SQLRooms is organized into several categories of packages:

#### Core Packages

These packages form the foundation of any SQLRooms application:

- **[@sqlrooms/project-builder](https://sqlrooms.github.io/api/project-builder/)**: The central package that provides the foundation for building analytics applications with Zustand-based state management. It handles project state management using a composable slice-based architecture, allowing applications to combine and extend functionality from different modules. The package integrates the panel system and includes DuckDB integration to keep track of database tables created as part of the project.

- **[@sqlrooms/project-config](https://sqlrooms.github.io/api/project-config/)**: Defines central configuration and type definitions using Zod schemas. It provides TypeScript types and interfaces along with essential constants and utilities used throughout the framework.

- **[@sqlrooms/duckdb](https://sqlrooms.github.io/api/duckdb/)**: Provides DuckDB integration for query execution and data source connections. It manages DuckDB-WASM instances and handles query execution with robust data source connection capabilities and ensures type-safe query results for reliable data operations.

- **[@sqlrooms/ui](https://sqlrooms.github.io/api/ui/)**: Offers a comprehensive UI toolkit based on shadcn/ui with Tailwind preset. It includes a carefully crafted Tailwind preset configuration, a library of common UI components, robust theme management capabilities, and a collection of icons and assets.

#### Feature Packages

These packages provide specific functionality that can be added as needed:

- **[@sqlrooms/data-table](https://sqlrooms.github.io/api/data-table/)**: An advanced interactive data grid component designed for SQL query result visualization. The table supports dynamic column sorting and pagination features for efficient data exploration and analysis.

- **[@sqlrooms/sql-editor](https://sqlrooms.github.io/api/sql-editor/)**: A powerful SQL query editor that enhances the development experience with syntax highlighting and intelligent auto-completion. It maintains a query history for easy reference and provides integrated result visualization capabilities.

- **[@sqlrooms/layout](https://sqlrooms.github.io/api/layout/)**: A sophisticated layout system and panel management solution based on [react-mosaic](https://nomcopter.github.io/react-mosaic/) that enables flexible panel layouts with intuitive sidebar and main view management. It supports smooth panel resize functionality and ensures layout persistence across sessions.

- **[@sqlrooms/s3-browser](https://sqlrooms.github.io/api/s3-browser/)**: A feature-rich S3-compatible storage browser that provides an intuitive file browsing interface. It supports file upload and download operations, comprehensive directory management, and seamless S3 bucket integration.

- **[@sqlrooms/vega](https://sqlrooms.github.io/api/vega/)**: A data visualization package that integrates [Vega-Lite](https://vega.github.io/vega-lite/) for creating sophisticated interactive visualizations. It provides React components for rendering Vega specifications and handling visualization interactions.

- **[@sqlrooms/ai](https://sqlrooms.github.io/api/ai/)**: An AI integration package that enables natural language querying and analysis capabilities. It provides tools for query generation, result interpretation, and interactive AI-powered analytics workflows.

- **[@sqlrooms/cosmos](https://sqlrooms.github.io/api/cosmos/)**: A graph visualization package that integrates [Cosmos](https://github.com/cosmograph-org/cosmos) for creating interactive network visualizations. It provides high-performance WebGL-based graph rendering capabilities with support for large-scale networks.

- **[@sqlrooms/dropzone](https://sqlrooms.github.io/api/dropzone/)**: A comprehensive file upload solution that implements drag-and-drop functionality. It provides sophisticated file upload handling with built-in file type validation and upload progress tracking to enhance the user experience.

- **[@sqlrooms/mosaic](https://sqlrooms.github.io/api/mosaic/)**: A visualization package that integrates with [UW Interactive Data Lab's Mosaic library](https://idl.uw.edu/mosaic/). It provides declarative chart specifications and interactive visualization capabilities for data analysis.

- **[@sqlrooms/monaco-editor](https://sqlrooms.github.io/api/monaco-editor/)**: A powerful code editing package that integrates [Monaco Editor](https://microsoft.github.io/monaco-editor/) (the editor that powers VS Code). It provides customizable text editing components with features like syntax highlighting, code completion, and theming. The package includes specialized editors for JSON with schema validation support.

#### Utility Packages

- **[@sqlrooms/utils](https://sqlrooms.github.io/api/utils/)**: A utility package providing shared helper functions for color manipulation, data formatting, random generation, and string operations used across the framework.
- **[@sqlrooms/typescript-config](https://sqlrooms.github.io/api/typescript-config/)**: Shared TypeScript configuration
- **[@sqlrooms/eslint-config](https://sqlrooms.github.io/api/eslint-config/)**: Shared ESLint configuration
- **[@sqlrooms/typedoc-config](https://sqlrooms.github.io/api/typedoc-config/)**: Shared TypeDoc configuration

### Extension Points

The framework is designed to be highly extensible through:

1. **Extended ProjectStore**

   - Custom project configuration using Zod schemas
   - Additional state management
   - Integration with other services

2. **Custom Views and Panels**
   - Create specialized views for specific use cases
   - Configure panel layouts and behavior
   - Integrate with existing panel management

### Data Flow

1. Data sources (CSV, Parquet) are loaded through the dropzone, the S3 browser or custom import methods
2. DuckDB processes queries locally in the browser
3. Results are displayed in the DataTable view or custom visualizations
4. Project state can be saved and loaded for persistence

## Understanding the Slice-Based Architecture

SQLRooms uses a slice-based architecture powered by Zustand for state management. This approach allows you to compose different functionality slices into a unified application state.

### What is a Slice?

A slice is a modular piece of state and associated actions that can be combined with other slices to form a complete application state. Each feature package typically provides its own slice that can be integrated into your application.

For example, from the AI example application:

```typescript
// Combining multiple slices into a unified application state
export type AppState = ProjectState<AppConfig> &
  AiSliceState &
  SqlEditorSliceState &
  CustomAppState;
```

### How to Combine Slices

Slices are combined in the store creation process. Here's an example from the AI example application:

```typescript
// Creating a store with multiple slices
const useStore = create<AppState>()(
  immer((set, get, store) => ({
    // Base project state
    ...createProjectSlice<AppConfig>({
      // Project configuration
      // ...
    })(set, get, store),

    // SQL editor slice
    ...createSqlEditorSlice()(set, get, store),

    // AI slice with custom configuration
    ...createAiSlice({
      getApiKey: (modelProvider: string) => {
        return get()?.apiKeys[modelProvider] || '';
      },
      // Add custom tools
      customTools: {
        // Add the VegaChart tool from the vega package
        chart: createVegaChartTool(),

        // Example of adding a simple echo tool
        echo: {
          description: 'A simple echo tool that returns the input text',
          parameters: z.object({
            text: z.string().describe('The text to echo back'),
          }),
          execute: async ({text}: {text: string}) => {
            return {
              llmResult: {
                success: true,
                details: `Echo: ${text}`,
              },
            };
          },
          component: EchoToolResult,
        },
      },
      // Additional configuration...
    })(set, get, store),

    // Custom application state
    // ...
  })),
);
```

This approach allows you to:

1. Include only the slices you need
2. Customize each slice with your own configuration
3. Extend slices with additional functionality
4. Create custom slices for application-specific features

## Integration Examples

### Basic Integration

Here's a simple example of how to integrate SQLRooms packages in a React application:

```tsx
import {ProjectBuilder} from '@sqlrooms/project-builder';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {useDisclosure} from '@sqlrooms/ui';

export const App = () => {
  const sqlEditor = useDisclosure();

  return (
    <div className="flex h-full w-full">
      <div className="flex h-full w-full flex-col">
        <ProjectBuilder />
      </div>
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
    </div>
  );
};
```

### Advanced Integration with Multiple Features

For more complex applications, you can combine multiple packages:

```tsx
import {
  ProjectBuilder,
  ProjectBuilderSidebarButtons,
} from '@sqlrooms/project-builder';
import {SqlEditorModal} from '@sqlrooms/sql-editor';
import {ThemeSwitch, useDisclosure} from '@sqlrooms/ui';
import {VegaVisualization} from '@sqlrooms/vega';
import {AiAssistant} from '@sqlrooms/ai';
import {FileDropzone} from '@sqlrooms/dropzone';
import {TerminalIcon} from 'lucide-react';

export const AdvancedApp = () => {
  const sqlEditor = useDisclosure();

  return (
    <div className="flex h-full w-full">
      <div className="bg-muted/50 flex h-full flex-col px-1 py-2">
        <ProjectBuilderSidebarButtons />
        <SidebarButton
          title="SQL Editor"
          onClick={sqlEditor.onToggle}
          icon={TerminalIcon}
        />
        <ThemeSwitch />
      </div>
      <div className="flex h-full w-full flex-col">
        <FileDropzone>
          <ProjectBuilder>
            <AiAssistant />
            <VegaVisualization />
          </ProjectBuilder>
        </FileDropzone>
      </div>
      <SqlEditorModal isOpen={sqlEditor.isOpen} onClose={sqlEditor.onClose} />
    </div>
  );
};
```

## Extending with Custom Tools and Functionality

SQLRooms allows you to extend existing slices with custom functionality. For example, you can add custom tools to the AI slice:

```typescript
...createAiSlice({
  // Configuration...
  customTools: {
    // Add the VegaChart tool from the vega package
    chart: createVegaChartTool(),

    // Example of adding a simple echo tool
    echo: {
      description: 'A simple echo tool that returns the input text',
      parameters: z.object({
        text: z.string().describe('The text to echo back'),
      }),
      execute: async ({text}: {text: string}) => {
        return {
          llmResult: {
            success: true,
            details: `Echo: ${text}`,
          },
        };
      },
      component: EchoToolResult,
    },
  },
})(set, get, store)
```

This extensibility allows you to customize the behavior of each slice to meet your specific requirements.

## Best Practices for Combining Packages

When combining SQLRooms packages, consider these best practices:

1. **Start with Core Packages**: Always begin with the core packages (`project-builder`, `project-config`, `duckdb`, and `ui`)
2. **Add Features Incrementally**: Add feature packages one at a time to ensure compatibility
3. **Consider Dependencies**: Some feature packages may have dependencies on others, so check the documentation
4. **Optimize Bundle Size**: Only include the packages you need to keep your application lightweight
5. **Version Consistency**: Use consistent versions across all SQLRooms packages to avoid compatibility issues
6. **Customize Slices**: Take advantage of the configuration options provided by each slice to customize behavior
7. **Extend with Custom State**: Add your own custom state slices to handle application-specific functionality

## Real-World Examples

For inspiration on how to combine packages, check out the example applications in the SQLRooms repository:

- **[AI Example](https://github.com/sqlrooms/sqlrooms/tree/main/examples/ai)**: Demonstrates integration with AI capabilities
- **[Cosmos Example](https://github.com/sqlrooms/sqlrooms/tree/main/examples/cosmos)**: Shows graph visualization capabilities
- **[Cosmos Embedding Example](https://github.com/sqlrooms/sqlrooms/tree/main/examples/cosmos-embedding)**: Illustrates 2D embedding visualization
- **[Mosaic Example](https://github.com/sqlrooms/sqlrooms/tree/main/examples/mosaic)**: Showcases interactive dashboards with Mosaic

## Conclusion

SQLRooms' modular architecture gives you the flexibility to build exactly the data analytics application you need. By combining different packages and slices, you can create anything from simple data explorers to complex AI-powered analytics dashboards, all running entirely in the browser.

The slice-based architecture makes it easy to pick and choose the functionality you need while maintaining a clean and organized codebase. This approach allows for maximum flexibility and extensibility, enabling you to create custom solutions tailored to your specific requirements.

For more detailed information on each package, refer to the [API documentation](https://sqlrooms.github.io/api/).
