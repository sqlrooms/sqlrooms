---
outline: deep
---

# Why SQLRooms?

Building data analytics applications often requires integrating multiple complex components: a SQL query engine, data visualization tools, state management, and a cohesive UI. Each of these brings its own challenges, from handling large datasets to managing application state and providing a good user experience. SQLRooms combines these components into a unified framework, making it significantly easier to build analytics applications that run entirely in the browser. See the [Overview](/overview) for more details about how these components work together.

## Who is it for?

SQLRooms is designed for developers building:

- Interactive data analysis tools
- Custom BI solutions
- Data visualization applications
- Internal analytics dashboards

## Why DuckDB in the Browser?

DuckDB's WebAssembly implementation enables running a full-featured analytical database directly in the browser. This brings unprecedented capabilities to web-based analytics:

### Privacy and Security

All data processing happens locally in the browser, eliminating the need for a backend server. This not only simplifies deployment but also helps with data privacy compliance as sensitive data never leaves the client.

### Performance

By processing data locally with DuckDB's columnar engine and WebAssembly SIMD acceleration, queries run with near-native performance and zero network latency. Large files can be processed efficiently through streaming, without loading them entirely into memory.

### Cost and Scale

Each user gets their own DuckDB instance running in their browser, providing automatic scaling without infrastructure costs. Applications can even work offline, as there's no dependency on backend services.

### AI-Powered Analytics

The browser-based DuckDB engine enables powerful AI-driven analytics workflows:

- Interactive AI agents that can write and execute SQL queries
- Automated data analysis and insights generation

Check out our [Next.js AI example](/examples/nextjs-ai) that demonstrates how to build an AI agent that can analyze your data using natural language, execute SQL queries, and provide insights – all running directly in the browser.

## The Framework

SQLRooms provides a complete foundation for building modern analytics applications:

### State Management

Built on Zustand, the framework offers a centralized, type-safe store for managing application state, project configuration, and data sources. Project state can be easily saved and loaded.

### UI Components

A professional set of components built with Tailwind CSS provides a consistent, responsive interface out of the box. The panel system allows flexible layouts while maintaining a cohesive look and feel.

### Developer Experience

The framework emphasizes type safety and extensibility. Ready-to-use components like DataTable, SQL Editor, and S3 Browser accelerate development, while the plugin architecture allows easy customization.
