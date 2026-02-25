### Multi-Room

[Github repo](https://github.com/sqlrooms/sqlrooms/tree/main/examples/multi-room)

<video src="/media/examples/multi-room.mp4" alt="SQLRooms Multi-Room example" width="450" controls loop muted></video>

A multi-room application demonstrating how to manage multiple independent data workspaces with proper DuckDB lifecycle management. Features include:

- TanStack Router with room list (`/`) and room detail (`/room/:id`) pages
- IndexedDB-backed room configs for persistent storage
- Room CRUD operations (create, rename, delete)
- Each room gets its own isolated DuckDB WASM instance
- Proper store initialization and destruction on room navigation
- Paginated data table preview using `QueryDataTable`
- Pre-seeded with two sample rooms: Earthquakes and BIXI bike locations

#### Running locally

```sh
pnpm install
pnpm dev
```
