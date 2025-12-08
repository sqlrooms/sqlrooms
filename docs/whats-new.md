---
outline: deep
---

# What's New

New features, improvements, and notable changes in each SQLRooms release. For migration steps and breaking changes, see the [Upgrade Guide](/upgrade-guide).

## 0.26.1-rc.7 (2025-12-05)

### Replaced barrel exports across all modules

Barrel exports (i.e., `export * from ...`) were replaced across all modules to improve tree-shaking, reduce bundle size, and avoid import path ambiguities. Direct/explicit exports now ensure only the required symbols are included in consumers' builds, making dependencies clearer and preventing accidental re-exports or circular dependencies.

### TabStrip component in `@sqlrooms/ui`

A composable tab strip with drag-to-reorder, inline renaming, and a search dropdown for reopening closed tabs. Supports custom tab menus and flexible layouts via subcomponents (`TabStrip.Tabs`, `TabStrip.SearchDropdown`, `TabStrip.NewButton`).

<video src="/media/whats-new/tab-strip-component.mp4" alt="SQLRooms TabStrip component" width="450" loop muted controls autoplay></video>

### Kepler integration

Added [Kepler.gl](https://kepler.gl/) integration module for geospatial data visualization.

<img src="/media/examples/kepler.webp" alt="SQLRooms Kepler.gl geospatial visualization example" width=450>

Check the [Kepler example](https://github.com/sqlrooms/examples/tree/main/examples/kepler)

### AI RAG module

New `@sqlrooms/ai-rag` module for Retrieval Augmented Generation. Query your documentation using vector similarity search powered by DuckDB's native vector capabilities.

<img src="/media/examples/rag.webp" alt="SQLRooms AI RAG example" width=450>

Check the [AI RAG example](https://github.com/sqlrooms/examples/tree/main/examples/ai-rag)

## 0.26.0 (2025-11-17)

### AI SDK v5

We migrated to Vercel AI SDK v5. Now supporting agents: check the [ai-agent example](https://github.com/sqlrooms/sqlrooms/tree/main/examples/ai-agent)
