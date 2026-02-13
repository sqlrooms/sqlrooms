---
title: Deployment Scenarios
outline: [2, 3]
---

# Deployment Scenarios

SQLRooms supports multiple deployment models, from fully browser-only apps to server-backed collaborative setups. This guide helps teams choose a scenario based on infrastructure constraints, collaboration needs, and data governance requirements.

## Quick decision matrix

| Scenario | Infra needed | Data storage | App state storage | Collaboration | Offline | Best fit |
| --- | --- | --- | --- | --- | --- | --- |
| Browser-only (WASM + object storage) | Static frontend + object storage | Parquet/object files in S3-compatible storage | Browser `localStorage` or IndexedDB; optional OPFS DuckDB files | Low (share links/files) | Partial to strong (depends on caching/OPFS) | Read-heavy BI where users only have a browser |
| Browser + Iceberg catalogs | Frontend + catalog + object storage | Iceberg tables in catalog/object storage | Browser local state or backend metadata (optional) | Medium (shared tables/workflows) | Limited | Governed read/write table workflows |
| Server-backed shared rooms (`sqlrooms-server`) | Frontend + WebSocket backend + DuckDB server runtime | Server DuckDB database (plus optional external sources) | Server meta schema/`--meta-db` + optional browser persistence | High (multi-user live sync) | Low (network required for shared state) | Teams collaborating in the same workspace/session |
| Offline-capable PWA | Frontend + PWA service worker | Browser OPFS DuckDB files/local files | Browser `localStorage` or IndexedDB | Low (single-user local-first) | Strong | Field/offline use and privacy-sensitive workflows |
| Desktop packaging (Electron/Tauri) | Desktop wrapper + local runtime | Local filesystem/embedded DB or backend-connected | Local files + browser-like storage in app shell | Low to medium (depends on backend) | Strong (for local mode) | Managed desktop deployments and native distribution |

## 1) Browser-only analytics (DuckDB WASM + object storage)

This is the simplest setup for traditional BI-style analytics with many managers using only a browser.

- **How it works:** SQLRooms runs in the browser with DuckDB WASM, reading parquet (or other supported files) from object storage.
- **Data storage:** S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, etc.).
- **App state storage:** Browser `localStorage` or IndexedDB; optionally OPFS for persisted DuckDB files.
- **Access patterns:** Signed URLs, backend-issued short-lived credentials, or DuckDB Secrets Manager where applicable.
- **Best fit:** Read-heavy self-service analytics with minimal backend operations.

Examples and references:

- [AI example](https://sqlrooms.org/examples#ai-powered-analytics)
- [SQL Query Editor](https://query.sqlrooms.org/)
- [Kepler example](https://kepler.sqlrooms.org/)

## 2) Browser clients with editable shared datasets (Iceberg catalogs)

Use this scenario when teams need shared read/write datasets with stronger governance than individual parquet files.

- **How it works:** Browser clients query and update catalog-managed tables.
- **Data storage:** Iceberg tables in object storage, with a catalog layer.
- **App state storage:** Browser local state and optionally backend metadata storage.
- **Best fit:** Teams that need managed table lifecycle and shared editable data assets.

Potential ecosystem options include Amazon S3 Tables and Cloudflare R2 Data Catalog. Browser write/read capabilities depend on current DuckDB + browser connector support.

Reference:

- [DuckDB: Iceberg in the Browser](https://duckdb.org/2025/12/16/iceberg-in-the-browser)

## 3) Collaborative shared rooms with `sqlrooms-server`

Use server-backed sessions when many users need to see and edit the same analytical workspace in near real time.

- **How it works:** A shared server runtime hosts DuckDB + sync endpoints; browser clients connect over WebSockets.
- **Data storage:** Server DuckDB database (with optional remote sources/extensions).
- **App state storage:** Server-side metadata in the default meta schema or dedicated `--meta-db`, plus optional browser persistence.
- **Best fit:** Team collaboration in a shared room, coordinated analysis, and synchronized state.

A common deployment pattern is session-per-room on demand (for example, containerized workers).

Examples and references:

- [Sync example](https://github.com/sqlrooms/examples/tree/main/sync)
- [`sqlrooms-server` README](https://github.com/sqlrooms/sqlrooms/tree/main/python/sqlrooms-server)

## 4) Offline-capable PWA

Choose this for local-first experiences where users must continue working without network access.

- **How it works:** SQLRooms is shipped as a PWA with service worker caching and local DuckDB persistence.
- **Data storage:** Browser OPFS (DuckDB files), local file imports.
- **App state storage:** `localStorage` or IndexedDB.
- **Best fit:** Offline analysis, privacy-first workflows, and disconnected environments.

Examples and references:

- [Offline Use](https://sqlrooms.org/offline-use)
- [Query PWA example](https://github.com/sqlrooms/examples/tree/main/query-pwa)

## 5) Desktop packaging (Electron/Tauri)

SQLRooms can be packaged as a desktop app using Electron or Tauri.

- **How it works:** A desktop shell hosts the SQLRooms web app.
- **Runtime options:** In-app DuckDB WASM, or native DuckDB via a local backend such as `sqlrooms-server`.
- **Data storage:** Local filesystem/embedded database, optionally with remote sources.
- **App state storage:** Local files and browser-like storage inside the desktop shell.
- **Best fit:** Organizations that prefer managed desktop distribution and local data residency.

Current status: SQLRooms does not provide direct Electron integration and there is no first-party Electron example today.

## Choose this when...

- **Browser-only (WASM + object storage):** You want lowest operational overhead and browser-only access.
- **Browser + Iceberg:** You need shared, governed, editable tables.
- **`sqlrooms-server` shared rooms:** You need synchronized multi-user collaboration in the same workspace.
- **Offline PWA:** Users must work reliably without internet.
- **Desktop packaging:** You need installable desktop apps and tighter device-level controls.

A hybrid model is also common: start with browser-only or PWA for most users, and add server-backed shared rooms for collaborative teams.
