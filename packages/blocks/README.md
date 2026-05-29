# @sqlrooms/blocks

Shared contracts and vocabulary for composable SQLRooms blocks.

This package intentionally contains no feature runtime, stores, or UI
implementations. Feature packages own concrete block definitions:

- `@sqlrooms/mosaic` owns dashboard/chart block implementations.
- `@sqlrooms/pivot` owns pivot block implementations.
- `@sqlrooms/documents` owns document and rich content block implementations.
- Notebook/canvas/app packages own their own stateful block implementations.

`@sqlrooms/blocks` provides the small shared contract layer that lets those
implementations be hosted consistently in artifacts, documents, notebooks, or
other block containers.
