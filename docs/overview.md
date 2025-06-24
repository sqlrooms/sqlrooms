---
outline: deep
---

# Overview

SQLRooms provides a comprehensive foundation and rich set of building blocks for creating modern, interactive data-analytics applications that can run entirely in the browser.
At its core is the concept of a **_Room_** — a self‑contained workspace where data lives, analysis happens, and (soon) collaborators meet. It combines essential components like a SQL query engine (DuckDB), data visualization tools, state management, and UI components into a cohesive toolkit, making it significantly easier to create powerful analytics tools with or without a backend.

![SQLRooms example apps](/media/overview/collage.webp)

## Why SQLRooms?

SQLRooms is designed to empower developers and users with a modern, modular analytics toolkit that runs entirely in the browser. Here's what sets it apart:

- **Performance & Scale:** Every user gets a dedicated in-browser DuckDB instance, delivering columnar analytics speed with zero backend load.
- **Modular Architecture:** Mix and match packages, and combine state _slices_ to include only the features you need—no bloat, just what your app requires.
- **AI‑Powered Analytics:** Built-in support for agents that can write and execute SQL queries, and generate insights directly in your browser—no server roundtrips required.
- **Developer Experience:** A composable, React-based framework with ready-to-use components, state management, and visualization tools, making it easy to build custom analytics solutions.

## Why Single-Node?

SQLRooms is designed for single-node analytics: all computation happens on your device, whether in the browser or a desktop app (e.g. via [Electron](https://www.electronjs.org/)), with no backend required. Data can remain local if you choose, or be loaded from external sources like S3—always giving you full control over how and where your data is processed. This approach is inspired by [Local-First principles](https://www.inkandswitch.com/essay/local-first), prioritizing user control, privacy, and speed. While SQLRooms does not yet implement sync or collaboration, it delivers the core benefits of local-first software—your data and computation stay private and accessible on your device.

- **Privacy:** All data remains on your device for simplified compliance and peace of mind—nothing leaves your browser unless you choose.
- **Own Your Data:** You control your files and data, with no vendor lock-in or forced cloud storage. Your work is portable and future-proof.
- **Offline Use:** SQLRooms [supports fully offline work](/offline-use)—query, analyze, and visualize your data even without an internet connection.
- **Fast Local Querying:** Queries run instantly in your browser, with no network roundtrip or server lag—results are available as soon as you ask.
- **Private AI Insights:** AI agents generate insights and run queries locally, so your data is never shared with external model providers. You get the power of AI-driven analytics without sacrificing privacy.

## Next Steps

- **Check the [Example applications](/examples)** to see what can be built with the framework.

- **Explore the [Modular Architecture](/modular-architecture)** to see how you can compose and extend your app.

- **Review the [Key Concepts](/key-concepts)** to understand the core ideas and architecture.

- **Quick start the [Getting Started Guide](/getting-started)** to set up your first room.

- **Read the [API reference](/packages/)** for deeper integration.
