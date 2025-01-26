---
outline: deep
---

# What is SQLRooms?

SQLRooms provides a foundation and set of building blocks for creating data analytics applications that run entirely in the browser. It combines essential components like a SQL query engine (DuckDB), data visualization tools, state management, and UI components into a cohesive toolkit, making it significantly easier to create powerful analytics tools without a backend.

## Who is it for?

SQLRooms is designed for developers building:

- Interactive data analysis tools
- Custom BI solutions
- Data visualization applications
- Internal analytics dashboards

## Motivation

Modern data analytics applications face several challenges that SQLRooms addresses:

### Privacy and Security

By running DuckDB directly in the browser, all data processing happens locally. Sensitive data never leaves the client, simplifying compliance and security.

### Performance and Scale

DuckDB is purpose-built for analytics, providing fast query performance on large datasets through its columnar engine and optimized query processing. Running in the browser through WebAssembly, each user gets their own instance, enabling automatic scaling without infrastructure costs. Applications can even work offline, as there's no dependency on backend services.

### Developer Experience

Building analytics applications typically requires integrating multiple complex components. SQLRooms provides a complete foundation with state management, UI components, and extensible architecture out of the box.

### AI-Powered Analytics

The browser-based DuckDB engine enables powerful AI-driven analytics workflows:

- Interactive AI agents that can write and execute SQL queries
- Automated data analysis and insights generation

Check out our [Next.js AI example](/examples/#ai-powered-analytics-next-js) that demonstrates how to build an AI agent that can analyze your data using natural language, execute SQL queries, and provide insights – all running directly in the browser.

## Architecture

SQLRooms is built around several core components that work together seamlessly:

![SQLRooms Architecture](/assets/architecture.svg)

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

1. Data sources (CSV, Parquet) are loaded through the S3 browser or custom import methods
2. DuckDB processes queries locally in the browser
3. Results are displayed in the DataTable view or custom visualizations
4. Project state can be saved and loaded for persistence

## Framework Features

### UI Components

A professional set of components built with Tailwind CSS provides a consistent, responsive interface out of the box. The panel system allows flexible layouts while maintaining a cohesive look and feel.

### DuckDB Integration

SQLRooms provides deep integration with DuckDB through built-in utilities that:

- Manage the DuckDB-WASM instance lifecycle
- Handle data source connections and imports
- Execute SQL queries and manage results
- Provide type-safe query results
