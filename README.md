# sqlrooms

Building blocks for React data analytics applications powered by [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview.html)

[Documentation](https://sqlrooms.github.io/) | [Examples](https://sqlrooms.org/examples.html)

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

- **[@sqlrooms/project-builder](https://sqlrooms.github.io/api/project-builder/)**: Foundation for building analytics applications with Zustand-based state management
- **[@sqlrooms/project-config](https://sqlrooms.github.io/api/project-config/)**: Central configuration and type definitions using Zod schemas
- **[@sqlrooms/duckdb](https://sqlrooms.github.io/api/duckdb/)**: DuckDB integration for query execution and data source connections
- **[@sqlrooms/ui](https://sqlrooms.github.io/api/ui/)**: Comprehensive UI toolkit based on shadcn/ui with Tailwind preset

### Feature Packages

- **[@sqlrooms/data-table](https://sqlrooms.github.io/api/data-table/)**: Interactive data grid for query result visualization
- **[@sqlrooms/sql-editor](https://sqlrooms.github.io/api/sql-editor/)**: SQL query editor with syntax highlighting and auto-completion
- **[@sqlrooms/layout](https://sqlrooms.github.io/api/layout/)**: Flexible panel management system
- **[@sqlrooms/s3-browser](https://sqlrooms.github.io/api/s3-browser/)**: S3-compatible storage browser for data management
- **[@sqlrooms/vega](https://sqlrooms.github.io/api/vega/)**: Data visualization integration with Vega-Lite
- **[@sqlrooms/ai](https://sqlrooms.github.io/api/ai/)**: Optional AI integration for natural language querying
- **[@sqlrooms/cosmos](https://sqlrooms.github.io/api/cosmos/)**: Graph visualization capabilities
- **[@sqlrooms/dropzone](https://sqlrooms.github.io/api/dropzone/)**: Drag-and-drop file upload functionality
- **[@sqlrooms/mosaic](https://sqlrooms.github.io/api/mosaic/)**: Integration with UW Interactive Data Lab's Mosaic library
- **[@sqlrooms/utils](https://sqlrooms.github.io/api/utils/)**: Shared helper functions for various operations

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

