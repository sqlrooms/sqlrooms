---
outline: deep
---

# Package Structure

SQLRooms is organized into several packages that work together to provide a complete framework for building analytics applications.

## Core Packages

### [@sqlrooms/project-builder](./api/project-builder/index.md)

Core framework package that provides the foundation for building analytics applications. It handles project state management using [Zustand](https://github.com/pmndrs/zustand) with a composable slice-based architecture, allowing applications to combine and extend functionality from different modules. The package integrates the panel system and includes DuckDB integration to keep track of database tables created as part of the project.

### [@sqlrooms/project-config](./api/project-config/index.md)

A central configuration and type definitions package that maintains base project configuration schemas and [Zod](https://zod.dev/) schema definitions. It provides TypeScript types and interfaces along with essential constants and utilities used throughout the framework.

### [@sqlrooms/duckdb](./api/duckdb/index.md)

A powerful DuckDB integration package that manages DuckDB-WASM instances and handles query execution. It provides robust data source connection capabilities and ensures type-safe query results for reliable data operations.

### [@sqlrooms/ui](./api/ui/index.md)

A comprehensive UI toolkit based on [shadcn/ui](https://ui.shadcn.com/) that provides shared components and styling utilities. It includes a carefully crafted Tailwind preset configuration, a library of common UI components, robust theme management capabilities, and a collection of icons and assets.

## Feature Packages

### [@sqlrooms/ai](./api/ai/index.md)

An AI integration package that enables natural language querying and analysis capabilities. It provides tools for query generation, result interpretation, and interactive AI-powered analytics workflows.

### [@sqlrooms/data-table](./api/data-table/index.md)

An advanced interactive data grid component designed for SQL query result visualization. The table supports dynamic column sorting and pagination features for efficient data exploration and analysis.

### [@sqlrooms/dropzone](./api/dropzone/index.md)

A comprehensive file upload solution that implements drag-and-drop functionality. It provides sophisticated file upload handling with built-in file type validation and upload progress tracking to enhance the user experience.

### [@sqlrooms/layout](./api/layout/index.md)

A sophisticated layout system and panel management solution based on [react-mosaic](https://nomcopter.github.io/react-mosaic/) that enables flexible panel layouts with intuitive sidebar and main view management. It supports smooth panel resize functionality and ensures layout persistence across sessions.

### [@sqlrooms/mosaic](./api/mosaic/index.md)

A visualization package that integrates with [UW Interactive Data Lab's Mosaic library](https://idl.uw.edu/mosaic/). It provides declarative chart specifications and interactive visualization capabilities for data analysis.

### [@sqlrooms/s3-browser](./api/s3-browser/index.md)

A feature-rich S3-compatible storage browser that provides an intuitive file browsing interface. It supports file upload and download operations, comprehensive directory management, and seamless S3 bucket integration.

### [@sqlrooms/sql-editor](./api/sql-editor/index.md)

A powerful SQL query editor that enhances the development experience with syntax highlighting and intelligent auto-completion. It maintains a query history for easy reference and provides integrated result visualization capabilities.

### [@sqlrooms/cosmos](./api/cosmos/index.md)

A graph visualization package that integrates [Cosmos](https://github.com/cosmograph-org/cosmos) for creating interactive network visualizations. It provides high-performance WebGL-based graph rendering capabilities with support for large-scale networks. See [Cosmos integration example](/examples#cosmos-graph-visualization).

### [@sqlrooms/monaco-editor](./api/monaco-editor/index.md)

A powerful code editing package that integrates [Monaco Editor](https://microsoft.github.io/monaco-editor/) (the editor that powers VS Code). It provides customizable text editing components with features like syntax highlighting, code completion, and theming. The package includes specialized editors for JSON with schema validation support.

### [@sqlrooms/utils](./api/utils/index.md)

A utility package providing shared helper functions for color manipulation, data formatting, random generation, and string operations used across the framework.

### [@sqlrooms/vega](./api/vega/index.md)

A data visualization package that integrates [Vega-Lite](https://vega.github.io/vega-lite/) for creating sophisticated interactive visualizations. It provides React components for rendering Vega specifications and handling visualization interactions.
