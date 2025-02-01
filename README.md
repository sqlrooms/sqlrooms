# sqlrooms

Building blocks for React data analytics applications powered by [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview.html)

[Documentation](https://sqlrooms.github.io/)

<img width=600 src=https://github.com/user-attachments/assets/1897cb57-9602-493c-ad82-2723c9f4e0f7>

## Develop locally

    pnpm install
    pnpm dev

## Running Next.js example app

    pnpm install
    pnpm --filter sqlrooms-nextjs-ai dev
    open http://localhost:3000

## Running vite example app

    pnpm install
    pnpm --filter sqlrooms-vite-mosaic dev
    open http://localhost:5174

## Usage

Check out the [examples repository](https://github.com/sqlrooms/examples).

## Publishing

Bump all versions:

    pnpm version [major|minor|patch]

Publish all packages:

    pnpm publish-packages

Publish preview versions:

    pnpm publish-preview
