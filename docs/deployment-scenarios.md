---
title: Deployment Scenarios
outline: [2, 3]
---

# Deployment Scenarios

SQLRooms supports multiple deployment models, from fully browser-only apps to server-backed collaborative setups. This guide helps teams choose a scenario based on infrastructure constraints, collaboration needs, and data governance requirements.

## 1) Browser-only analytics for read-mostly use cases (DuckDB WASM + object storage)

This is the simplest setup for traditional BI-style analytics with many managers using only a browser, especially when shared data is mostly consumed rather than collaboratively edited.

- **How it works:** SQLRooms runs in the browser with DuckDB WASM, reading parquet (or other supported files) from object storage.
- **Data storage:** S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, etc.).
- **App state storage:** Browser `localStorage` or IndexedDB; optionally OPFS for persisted DuckDB files.
- **Access patterns:** Signed URLs, backend-issued short-lived credentials, or DuckDB Secrets Manager where applicable.
- **Best fit:** Read-only or read-mostly self-service analytics with minimal backend operations.
- **At a glance:** Lowest ops complexity; low collaboration on shared data; partial/strong offline depending on caching and OPFS usage (offline is reduced if you rely on cloud persistence like MotherDuck).

Examples and references:

- [AI example](/examples#ai-powered-analytics)
- [SQL Query Editor Example](/examples#sql-query-editor)

## 2) Browser clients with writable shared datasets

Use this scenario when teams need shared writable datasets with stronger governance and concurrency guarantees than individual parquet files.

- **How it works:** Browser clients query and update shared datasets via a managed DuckDB backend (for example MotherDuck) or catalog-managed table formats such as Iceberg.
- **Data storage:** MotherDuck-managed DuckDB storage, or Iceberg tables in object storage with a catalog layer.
- **App state storage:** Browser local state and optionally backend metadata storage.
- **Platform choice:** See [Backend platform options](#backend-platform-options-for-scenarios-2-and-3) for trade-offs between MotherDuck, Modal, Cloudflare, and Plane.
- **Best fit:** Teams that need managed table lifecycle, concurrent writes, and shared editable data assets.
- **At a glance:** Moderate infra complexity; medium collaboration through shared writable tables; limited offline.

Potential ecosystem options include [MotherDuck](https://motherduck.com/), [Amazon S3 Tables](https://aws.amazon.com/s3/features/tables/), and [Cloudflare R2 Data Catalog](https://developers.cloudflare.com/r2/data-catalog/). Browser write/read capabilities depend on current DuckDB + browser connector support.

Reference:

- [DuckDB: Iceberg in the Browser](https://duckdb.org/2025/12/16/iceberg-in-the-browser)
- [MotherDuck example](/examples#motherduck-cloud-query-editor)


## 3) Collaborative shared rooms with `sqlrooms-server` (coming soon)

Use server-backed sessions when many users need to see and edit the same analytical workspace in near real time.

- **How it works:** A shared server runtime hosts DuckDB + sync endpoints; browser clients connect over WebSockets.
- **Data storage:** Server DuckDB database (with optional remote sources/extensions).
- **Alternative persistence:** MotherDuck can be used as a managed central DuckDB backend when you prefer hosted durability over self-managed database files.
- **App state storage:** Server-side metadata in the default meta schema or dedicated `--meta-db`, plus optional browser persistence.
- **Platform choice:** See [Backend platform options](#backend-platform-options-for-scenarios-2-and-3) for trade-offs between managed persistence and per-room runtime platforms.
- **Best fit:** Team collaboration in a shared room, coordinated analysis, and synchronized state.
- **At a glance:** Highest collaboration; backend required; low offline for shared sessions.

A common deployment pattern is session-per-room on demand (for example, containerized workers). One practical option is [Cloudflare Containers](https://developers.cloudflare.com/containers/), which can spin up container instances on demand and route requests per session. As an open-source alternative, [Plane](https://plane.dev/) can run stateful WebSocket backends with per-session process isolation. Another option is [Modal Sandbox](https://modal.com/docs/guide/sandboxes), which can run isolated compute environments for data workloads.

Examples and references:

- [Sync example](https://github.com/sqlrooms/examples/tree/main/sync)
- [`sqlrooms-server` README](https://github.com/sqlrooms/sqlrooms/tree/main/python/sqlrooms-server)
- [Build your own data warehouse with DuckDB, DBT, and Modal](https://modal.com/docs/examples/dbt_duckdb)


## Backend platform options for Scenarios 2 and 3

In practice, teams can choose between managed data persistence (MotherDuck) and per-room compute runtimes (Modal/Cloudflare/Plane), or combine them.

- **Use MotherDuck when:** You have a business/enterprise budget and want managed DuckDB persistence, sharing, and operational simplicity. It is best as the durable data layer rather than the room runtime itself.
- **Use Modal when:** You want fast developer velocity for per-room isolated environments with persistent volumes and straightforward programmatic provisioning.
- **Use Cloudflare Containers when:** You prioritize low baseline cost and edge proximity, and are comfortable implementing extra persistence orchestration (for example with R2) for sleeping/ephemeral instances.
- **Use Plane when:** You want an open-source, self-hostable system for stateful per-session WebSocket backends with full control over infrastructure behavior.

Pricing and limits can change frequently, so treat platform economics as a regularly reviewed decision input.




## 4) Local session backend from CLI

This scenario is for single-user local workflows, similar to how Jupyter is often used: run a local backend process and connect from your browser.

- **How it works:** Start `sqlrooms-cli` from CLI on your laptop, then point a local SQLRooms app to that local server endpoint.
- **Data storage:** Local DuckDB file (or `:memory:`), with optional remote sources/extensions.
- **App state storage:** Primarily local browser state, with optional server-side metadata tables.
- **Best fit:** Power users and developers who want local control, reproducibility, and a backend runtime without deploying shared infrastructure.
- **At a glance:** Simple local setup; strong privacy; no built-in team collaboration unless you later promote it to shared deployment.

Reference:

- [`sqlrooms-cli` README](https://github.com/sqlrooms/sqlrooms/tree/main/python/sqlrooms-cli)


## 5) Offline-capable PWA

Choose this for local-first experiences where users must continue working without network access.

- **How it works:** SQLRooms is shipped as a PWA with service worker caching and local DuckDB persistence.
- **Data storage:** Browser OPFS (DuckDB files), local file imports.
- **App state storage:** `localStorage` or IndexedDB.
- **Best fit:** Offline analysis, privacy-first workflows, and disconnected environments.
- **At a glance:** Strong offline; simple architecture; collaboration is mostly asynchronous/manual.

Examples and references:

- [Offline Use](https://sqlrooms.org/offline-use)
- [Query PWA example](https://github.com/sqlrooms/examples/tree/HEAD/query-pwa)

## 6) Desktop packaging (Electron/Tauri)

SQLRooms can be packaged as a desktop app using Electron or Tauri.

- **How it works:** A desktop shell hosts the SQLRooms web app.
- **Runtime options:** In-app DuckDB WASM, or native DuckDB via a local backend such as `sqlrooms-server`.
- **Data storage:** Local filesystem/embedded database, optionally with remote sources.
- **Alternative persistence:** MotherDuck can back desktop deployments that need cloud-synced datasets across devices instead of only local files.
- **App state storage:** Local files and browser-like storage inside the desktop shell.
- **Best fit:** Organizations that prefer managed desktop distribution and local data residency.
- **At a glance:** Good for managed desktop environments; offline-friendly in local mode; collaboration depends on backend connectivity.

Current status: SQLRooms does not provide direct Electron integration and there is no first-party Electron example today.

Reference:

- [Foursquare Spatial Desktop case study](/case-studies.html#foursquare-spatial-desktop)

## Hybrid setups

Hybrid setups are also possible: start with browser-only or PWA for most users, and add server-backed shared rooms for teams that need real-time collaboration.
