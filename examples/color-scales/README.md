# SQLRooms color scales example

A Vite application showing `@sqlrooms/color-scales` legends for the SQLRooms
cars dataset.

The room store loads:

```ts
https://huggingface.co/datasets/sqlrooms/cars/resolve/main/cars.parquet
```

into DuckDB as the `cars` table, then renders sequential, diverging, quantile,
quantize, threshold, and categorical legends for columns in the dataset.

## Running locally

```sh
npm install
npm run dev
```
