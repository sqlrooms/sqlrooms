# <img src=https://github.com/user-attachments/assets/dd6b2929-29f5-4c8b-a0c0-51ec84603e6b width=23> SQLRooms

Building blocks for React data analytics applications powered by [DuckDB](https://duckdb.org/docs/api/wasm/overview.html)

[Documentation](https://sqlrooms.org/) | [Examples](https://sqlrooms.org/examples.html)

<img width=600 src=/docs/media/overview/collage.webp>

## Overview

SQLRooms is a comprehensive framework for building powerful data analytics applications that run entirely in the browser. It combines DuckDB's SQL capabilities with React to create interactive, client-side analytics tools without requiring a backend.

Check out our [example projects](https://sqlrooms.org/examples.html) to see what you can build with SQLRooms.

### Key Features

- **Browser-Based Analytics Engine**: Leverages DuckDB-WASM to process data directly in the browser, enabling offline functionality and eliminating backend dependencies.
- **Complete UI Framework**: Provides a rich set of React components including data tables, SQL editors, and visualization tools built with Tailwind CSS.
- **Flexible Layout System**: Includes a mosaic-style panel system for creating customizable, responsive dashboards.
- **Project Management**: Built-in state management for analytics projects with persistence capabilities.
- **Data Source Integration**: Support for various data sources including CSV, Parquet files, and S3-compatible storage.
- **AI-Ready**: Optional AI integration for natural language querying and automated insights.
- **Privacy-Focused**: All data processing happens client-side, keeping sensitive data local when needed.

### Core Packages

- **[@sqlrooms/project-builder](/packages/project-builder/)**: Foundation for building analytics applications with Zustand-based state management
- **[@sqlrooms/project-config](/packages/project-config/)**: Central configuration and type definitions using Zod schemas
- **[@sqlrooms/duckdb](/packages/duckdb/)**: DuckDB integration for query execution and data source connections
- **[@sqlrooms/ui](/packages/ui/)**: Comprehensive UI toolkit based on shadcn/ui with Tailwind preset

### Feature Packages

- **[@sqlrooms/data-table](/packages/data-table/)**: Interactive data grid for query result visualization
- **[@sqlrooms/sql-editor](/packages/sql-editor/)**: SQL query editor with syntax highlighting and auto-completion
- **[@sqlrooms/layout](/packages/layout/)**: Flexible panel management system
- **[@sqlrooms/s3](/packages/s3/)**: S3-compatible utils for data management
- **[@sqlrooms/s3-browser](/packages/s3-browser/)**: S3-compatible storage browser for data management
- **[@sqlrooms/vega](/packages/vega/)**: Data visualization integration with Vega-Lite
- **[@sqlrooms/ai](/packages/ai/)**: Optional AI integration for natural language querying
- **[@sqlrooms/cosmos](/packages/cosmos/)**: Graph visualization capabilities
- **[@sqlrooms/dropzone](/packages/dropzone/)**: Drag-and-drop file upload functionality
- **[@sqlrooms/mosaic](/packages/mosaic/)**: Integration with UW Interactive Data Lab's Mosaic library
- **[@sqlrooms/monaco-editor](/packages/monaco-editor/)**: Monaco Editor integration with specialized JSON editing support
- **[@sqlrooms/utils](/packages/utils/)**: Shared helper functions for various operations

### Use Cases

- Interactive data exploration and analysis tools
- Custom business intelligence dashboards
- Self-contained analytics applications
- Privacy-focused data processing solutions
- AI-powered data analysis workflows

See our [example projects](https://sqlrooms.org/examples.html) for real-world implementations, including:

- AI-powered analytics with natural language querying
- Graph visualization with Cosmos
- 2D embedding visualization
- Interactive dashboards with Mosaic

## Usage

Check out the [Getting Started](https://sqlrooms.github.io/getting-started.html) guide.

## Running example apps

    pnpm install
    pnpm build
    cd examples/ai
    pnpm dev
    open http://localhost:5173

## Develop locally

    pnpm install
    pnpm build
    pnpm dev

## Devel documentation locally

The documentation is built using [VitePress](https://vitepress.dev/) and [TypeDoc](https://typedoc.org/). To develop the documentation locally:

1. Install dependencies:

   ```bash
   pnpm install
   pnpm build
   pnpm docs:dev
   ```

   This will start a local server with hot-reloading at http://localhost:5173

2. Build the documentation:

   ```bash
   pnpm docs:build
   ```

3. Preview the built documentation:
   ```bash
   pnpm docs:preview
   ```
   This will serve the built documentation at http://localhost:4173

The documentation source files are located in the `docs/` directory. API documentation is automatically generated from TypeScript source code using TypeDoc.

## Working with media files (Git LFS)

This project uses Git Large File Storage (LFS) for managing media files in the documentation. To work with these files:

1. Install Git LFS on your system:

   ```bash
   # macOS (using Homebrew)
   brew install git-lfs

   # Ubuntu/Debian
   sudo apt install git-lfs
   ```

2. Initialize Git LFS in your local repository:

   ```bash
   git lfs install
   ```

3. Pull existing LFS files:

   ```bash
   git lfs pull
   ```

4. When adding new media files to the `docs/media/` directory, they will be automatically tracked by Git LFS as specified in the `.gitattributes` file.
