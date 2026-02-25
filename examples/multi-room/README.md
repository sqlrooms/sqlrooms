### Multi-Room

[Github repo](https://github.com/sqlrooms/sqlrooms/tree/main/examples/multi-room)

<video src="/media/examples/multi-room.mp4" alt="SQLRooms Multi-Room example" width="450" controls loop muted></video>

A multi-room application demonstrating how to manage multiple independent data workspaces with proper DuckDB lifecycle management. Features include:

- TanStack Router with room list (`/`) and room detail (`/room/:id`) pages
- Pre-seeded with two sample rooms: Earthquakes and BIXI bike locations
- Paginated data table preview using `QueryDataTable`
- Persistent storage for room configs in local storage
- Room CRUD operations (create, rename, delete)
- Proper store initialization and destruction on room navigation

To create a new project from the query example run this:

```bash
npx giget gh:sqlrooms/examples/multi-room my-new-app/
```

#### Running locally

```sh
pnpm install
pnpm dev
```
