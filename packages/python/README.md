Python runtime and block primitives for SQLRooms worksheets and block documents.

This package provides:

- persisted Python block state schemas for code, inputs, outputs, requirements,
  execution policy, and bounded last-result summaries
- `createPythonSlice()` for durable block state and runtime result updates
- a Pyodide worker runtime adapter with SQLRooms host-query bridge support
- `PythonBlock` and `createPythonBlockDefinition()` for embeddable
  worksheet/document blocks
- `createPythonBlockCommands()` for command-backed create, update, run, and
  clear operations

If no runtime adapter is configured, running a block records a bounded error
result instead of executing hidden Python.

## Store setup

```tsx
import {
  createPythonSlice,
  PythonSliceConfig,
  type PythonSliceState,
} from '@sqlrooms/python/block';

type RoomState = PythonSliceState;

const sliceConfigSchemas = {
  python: PythonSliceConfig,
};

const storeSlices = {
  ...createPythonSlice()(set, get, store),
};
```

## Runtime adapters

Adapters implement a small execution interface:

```ts
const adapter = {
  id: 'pyodide',
  status: async () => ({state: 'ready'}),
  execute: async (request, host) => ({
    executionId: request.executionId,
    status: 'success',
    stdout: '',
    stderr: '',
    outputs: [{type: 'json', name: 'result', value: 42}],
    durationMs: 5,
  }),
};
```

Pass the adapter to `createPythonSlice({runtimeAdapter: adapter})`.

The bundled Pyodide adapter captures the global `result` value, or the final
expression value when no `result` global is assigned. It returns JSON, text,
HTML, and Vega-Lite outputs when Python objects expose common rich-display
methods such as `_repr_mimebundle_()`, `_repr_html_()`, or Altair `to_dict()`.
HTML and Vega-Lite previews are rendered in sandboxed iframes by
`PythonBlock`.

When user code imports `altair`, the Pyodide worker installs Altair on demand
through `micropip`. The SQLRooms bridge exposes `sqlrooms.query()` and
`sqlrooms.query_df()` as pandas DataFrames, so query results can be passed
directly to libraries such as Altair. Use `sqlrooms.query_records()` for plain
row records and `sqlrooms.query_raw()` when column metadata or `rowCount` is
needed.

## Export paths

- `@sqlrooms/python/runtime` exports runtime contracts and the Pyodide adapter.
- `@sqlrooms/python/block` exports the React block, Zustand slice, commands,
  and block-facing state schemas.
- `@sqlrooms/python` is the curated root entrypoint.

## Worksheet commands

Use `createPythonBlockCommands({commandNamespace: 'worksheet'})` alongside the
worksheet block-document commands to expose:

- `worksheet.add-python-block`
- `worksheet.update-python-block-code`
- `worksheet.run-python-block`
- `worksheet.clear-python-block-result`
