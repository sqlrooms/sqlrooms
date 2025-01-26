# sqlrooms

Building blocks for creating interactive data analysis applications powered by DuckDB-WASM

[Documentation](https://sqlrooms.github.io/sqlrooms/)

<img width=600 src=https://github.com/user-attachments/assets/1897cb57-9602-493c-ad82-2723c9f4e0f7>

## Develop locally

    pnpm install
    pnpm dev

## Running Next.js example app

    pnpm install
    pnpm --filter nextjs-ai dev
    open http://localhost:3000

## Running vite example app

    pnpm install
    pnpm --filter vite-app dev
    open http://localhost:5174

## Usage

See example code in [examples/nextjs-ai](examples/nextjs-ai)

## Publishing

Bump all versions:

    pnpm version [major|minor|patch]

Publish all packages:

    pnpm publish-packages

Publish preview versions:

    pnpm publish-preview
