---
outline: deep
---

# Package Structure

SQLRooms is organized into several packages that work together to provide a complete framework for building analytics applications.

## Core Packages

| Package                                                     | Description                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@sqlrooms/project-builder](./api/project-builder/index.md) | Core framework package that provides the foundation for building analytics applications. It handles project state management and seamlessly integrates the panel system. The package includes comprehensive DuckDB integration and comes with a suite of built-in UI components to accelerate development. |
| [@sqlrooms/project-config](./api/project-config/index.md)   | A central configuration and type definitions package that maintains base project configuration schemas and Zod schema definitions. It provides TypeScript types and interfaces along with essential constants and utilities used throughout the framework.                                                 |
| [@sqlrooms/layout](./api/layout/index.md)                   | A sophisticated layout system and panel management solution that enables flexible panel layouts with intuitive sidebar and main view management. It supports smooth panel drag and drop functionality and ensures layout persistence across sessions.                                                      |
| [@sqlrooms/ui](./api/ui/index.md)                           | A comprehensive UI toolkit that provides shared components and styling utilities. It includes a carefully crafted Tailwind preset configuration, a library of common UI components, robust theme management capabilities, and a collection of icons and assets.                                            |

## Feature Packages

| Package                                           | Description                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@sqlrooms/data-table](./api/data-table/index.md) | An advanced interactive data grid component designed for SQL query result visualization. The table supports dynamic column sorting and filtering capabilities, intuitive row selection and pagination features, and can be extended with custom cell renderers for specialized data display. |
| [@sqlrooms/duckdb](./api/duckdb/index.md)         | A powerful DuckDB integration package that manages DuckDB-WASM instances and handles query execution. It provides robust data source connection capabilities and ensures type-safe query results for reliable data operations.                                                               |
| [@sqlrooms/dropzone](./api/dropzone/index.md)     | A comprehensive file upload solution that implements drag-and-drop functionality. It provides sophisticated file upload handling with built-in file type validation and upload progress tracking to enhance the user experience.                                                             |
| [@sqlrooms/s3-browser](./api/s3-browser/index.md) | A feature-rich S3-compatible storage browser that provides an intuitive file browsing interface. It supports file upload and download operations, comprehensive directory management, and seamless S3 bucket integration.                                                                    |
| [@sqlrooms/sql-editor](./api/sql-editor/index.md) | A powerful SQL query editor that enhances the development experience with syntax highlighting and intelligent auto-completion. It maintains a query history for easy reference and provides integrated result visualization capabilities.                                                    |
