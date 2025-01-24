---
outline: deep
---

# Overview

SQLRooms is built around several core components that work together to provide a flexible and powerful analytics application framework. For details about the individual packages, see the [Package Structure](/packages) page.

![SQLRooms Architecture](/images/architecture.svg)

## Core Components

### ProjectStore

The central state management system that handles:

- Project configuration (for saving and loading)
- Data source management
- Integration with DuckDB

The ProjectStore is built on top of Zustand and provides a type-safe way to manage your application's state. It can be extended with custom configuration and functionality specific to your needs.

### Project Builder

Provides the UI shell and panel layout system with:

- Configurable and pluggable views
- Sidebar and main view layouts
- Panel management

The Project Builder is responsible for the overall layout and structure of your application. It uses a flexible panel system that allows you to add custom views and arrange them as needed.

### Built-in Views

SQLRooms comes with several built-in views to handle common analytics tasks:

- **DataTable View**: For displaying and interacting with query results
- **S3 Browser**: For managing data sources and importing data
- **SQL Query Editor**: For writing and executing SQL queries

## Extension Points

The framework is designed to be highly extensible through several key points:

### 1. Extended ProjectStore

You can extend the base ProjectStore to add:

- Custom project configuration using Zod schemas
- Additional state management
- Custom methods and functionality
- Integration with other services

### 2. Custom Views and Panels

The panel system allows you to:

- Create custom views for specific use cases
- Add new panels to the sidebar or main area
- Configure panel layouts and behavior
- Integrate with the existing panel management system

## DuckDB Integration

SQLRooms provides deep integration with DuckDB through built-in utilities that:

- Manage the DuckDB-WASM instance lifecycle
- Handle data source connections and imports
- Execute SQL queries and manage results
- Provide type-safe query results

### Data Flow

1. Data sources (CSV, Parquet, etc.) are loaded through the S3 browser or custom import methods
2. DuckDB processes the data and executes queries
3. Results are displayed in the DataTable view or custom visualizations
4. Project state (including queries and configurations) can be saved and loaded
