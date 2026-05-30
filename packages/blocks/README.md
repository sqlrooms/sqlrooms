# @sqlrooms/blocks

Shared contracts and vocabulary for composable SQLRooms blocks.

Blocks are reusable units of SQLRooms workspace state or behavior. A block can
be small and local, like a text or chart block, or stateful, like a dashboard,
pivot table, notebook, or app surface. This package defines the shared language
for those block-shaped resources without owning their concrete runtime.

This package intentionally contains no feature runtime, stores, or UI
implementations. Feature packages own concrete block definitions:

- `@sqlrooms/mosaic` owns dashboard/chart block implementations.
- `@sqlrooms/pivot` owns pivot block implementations.
- `@sqlrooms/documents` owns document and rich content block implementations.
- Notebook/canvas/app packages own their own stateful block implementations.

`@sqlrooms/blocks` provides the small shared contract layer that lets those
implementations be hosted consistently in artifacts, documents, notebooks, or
other block containers.

## Concepts

- `BlockInstance` identifies a block and stores portable block attributes.
- `BlockReference` points at state managed elsewhere and records whether that
  state is owned, shared, or external.
- `StatefulBlockDefinition` describes how a feature package creates, ensures,
  renames, deletes, closes, and renders its block state.
- `OrderedBlockContainer` and `GraphBlockContainer` describe common container
  shapes: linear documents and DAG-like notebooks.

Concrete packages should keep their own state slices and renderers close to
their domain. For example, dashboard blocks remain owned by `@sqlrooms/mosaic`,
pivot blocks remain owned by `@sqlrooms/pivot`, and Markdown document blocks
remain owned by `@sqlrooms/documents`.

## Block Documents

The first rich ordered block container in SQLRooms is
[`BlockDocument`](../documents#block-documents) from `@sqlrooms/documents`.
`BlockDocument` uses these shared contracts to host text, images, charts, and
stateful blocks while keeping the editor/document runtime in the documents
package.

Use `@sqlrooms/blocks` when defining cross-package contracts for block-shaped
resources. Use `@sqlrooms/documents` when you need the Tiptap-backed
`BlockDocument` editor, persistence slice, commands, or AI authoring tools.
