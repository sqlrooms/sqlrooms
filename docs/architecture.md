# Modular Architecture

SQLRooms is designed with a modular architecture that allows developers to pick and choose exactly the functionality they need for their data analytics applications. This approach enables you to build custom solutions tailored to your specific requirements.

![SQLRooms Architecture](/media/overview/architecture.svg)

## Core Philosophy

The SQLRooms architecture follows these key principles:

1. **Modularity**: Each package has a specific, focused purpose
2. **Composability**: Packages can be combined in various ways to create custom applications
3. **Minimal Dependencies**: Packages only depend on what they absolutely need
4. **Consistent API Design**: All packages follow similar patterns for ease of use
5. [**Slice-Based State Management**](/state-management): State management uses a composable slice pattern that allows applications to combine functionality from different modules

## Core Components

### ProjectStore

The central state management system built on Zustand handles:

- Project configuration and persistence
- Data source management
- DuckDB integration
- Type-safe state management

The ProjectStore can be extended with custom configuration and functionality specific to your needs.

### Project Builder

Provides the application shell with:

- Configurable and pluggable views
- Flexible panel layouts
- Sidebar and main view management

### Built-in Views

Ready-to-use components accelerate development:

- DataTable View for displaying and interacting with query results
- S3 Browser for managing data sources and importing data
- SQL Query Editor with syntax highlighting

## Package Structure

SQLRooms is organized into several categories of packages:

### Core Packages

These packages form the foundation of any SQLRooms application:

- **[@sqlrooms/project-builder](/api/project-builder/)**: The central package that provides the foundation for building analytics applications with Zustand-based state management. It handles project state management using a composable slice-based architecture, allowing applications to combine and extend functionality from different modules. The package integrates the panel system and includes DuckDB integration to keep track of database tables created as part of the project.

- **[@sqlrooms/project-config](/api/project-config/)**: Defines central configuration and type definitions using Zod schemas. It provides TypeScript types and interfaces along with essential constants and utilities used throughout the framework.

- **[@sqlrooms/duckdb](/api/duckdb/)**: Provides DuckDB integration for query execution and data source connections. It manages DuckDB-WASM instances and handles query execution with robust data source connection capabilities and ensures type-safe query results for reliable data operations.

- **[@sqlrooms/ui](/api/ui/)**: Offers a comprehensive UI toolkit based on shadcn/ui with Tailwind preset. It includes a carefully crafted Tailwind preset configuration, a library of common UI components, robust theme management capabilities, and a collection of icons and assets.

### Feature Packages

These packages provide specific functionality that can be added as needed:

- **[@sqlrooms/ai](/api/ai/)**: An AI integration package that enables natural language querying and analysis capabilities. It provides tools for query generation, result interpretation, and interactive AI-powered analytics workflows.

- **[@sqlrooms/cosmos](/api/cosmos/)**: A graph visualization package that integrates [Cosmos](https://github.com/cosmograph-org/cosmos) for creating interactive network visualizations. It provides high-performance WebGL-based graph rendering capabilities with support for large-scale networks.

- **[@sqlrooms/data-table](/api/data-table/)**: An advanced interactive data grid component designed for SQL query result visualization. The table supports dynamic column sorting and pagination features for efficient data exploration and analysis.

- **[@sqlrooms/discuss](/api/discuss/)**: A discussion system for collaborative analytics applications. It provides threaded conversations, anchor-based discussions linked to data points, real-time state management, and customizable rendering components. The package includes built-in forms for adding, editing, and replying to comments with delete confirmation dialogs.

- **[@sqlrooms/dropzone](/api/dropzone/)**: A comprehensive file upload solution that implements drag-and-drop functionality. It provides sophisticated file upload handling with built-in file type validation and upload progress tracking to enhance the user experience.

- **[@sqlrooms/layout](/api/layout/)**: A sophisticated layout system and panel management solution based on [react-mosaic](https://nomcopter.github.io/react-mosaic/) that enables flexible panel layouts with intuitive sidebar and main view management. It supports smooth panel resize functionality and ensures layout persistence across sessions.

- **[@sqlrooms/monaco-editor](/api/monaco-editor/)**: A powerful code editing package that integrates [Monaco Editor](https://microsoft.github.io/monaco-editor/) (the editor that powers VS Code). It provides customizable text editing components with features like syntax highlighting, code completion, and theming. The package includes specialized editors for JSON with schema validation support.

- **[@sqlrooms/mosaic](/api/mosaic/)**: A visualization package that integrates with [UW Interactive Data Lab's Mosaic library](https://idl.uw.edu/mosaic/). It provides declarative chart specifications and interactive visualization capabilities for data analysis.

- **[@sqlrooms/recharts](/api/recharts/)**: A charting package that integrates [Recharts](https://recharts.org/) for creating responsive and customizable data visualizations. It provides React components for rendering various chart types including line charts, bar charts, pie charts, and more with built-in interactivity and animation support.

- **[@sqlrooms/s3-browser](/api/s3-browser/)**: A feature-rich S3-compatible storage browser that provides an intuitive file browsing interface. It supports file upload and download operations, comprehensive directory management, and seamless S3 bucket integration.

- **[@sqlrooms/schema-tree](/api/schema-tree/)**: Visualizes and explores database schemas as interactive trees.

- **[@sqlrooms/sql-editor](/api/sql-editor/)**: A powerful SQL query editor that enhances the development experience with syntax highlighting and intelligent auto-completion. It maintains a query history for easy reference and provides integrated result visualization capabilities.

- **[@sqlrooms/vega](/api/vega/)**: A data visualization package that integrates [Vega-Lite](https://vega.github.io/vega-lite/) for creating sophisticated interactive visualizations. It provides React components for rendering Vega specifications and handling visualization interactions.

### Utility Packages

- **[@sqlrooms/utils](/api/utils/)**: A utility package providing shared helper functions for color manipulation, data formatting, random generation, and string operations used across the framework.

## Extension Points

The framework is designed to be highly extensible through:

1. **Extended ProjectStore**

   - Custom project configuration using Zod schemas
   - Additional state management
   - Integration with other services

2. **Custom Views and Panels**
   - Create specialized views for specific use cases
   - Configure panel layouts and behavior
   - Integrate with existing panel management

## Data Flow

1. Data sources (CSV, Parquet) are loaded through the dropzone, the S3 browser or custom import methods
2. DuckDB processes queries locally in the browser
3. Results are displayed in the DataTable view or custom visualizations
4. Project state can be saved and loaded for persistence

This extensibility allows you to customize the behavior of each slice to meet your specific requirements.

# Conclusion

SQLRooms' modular architecture gives you the flexibility to build exactly the data analytics application you need. By combining different packages and slices, you can create anything from simple data explorers to complex AI-powered analytics dashboards, all running entirely in the browser.

The [slice-based state management](/state-management) makes it easy to pick and choose the functionality you need while maintaining a clean and organized codebase. This approach allows for maximum flexibility and extensibility, enabling you to create custom solutions tailored to your specific requirements.
