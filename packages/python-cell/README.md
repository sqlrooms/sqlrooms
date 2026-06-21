Python cell blocks for SQLRooms worksheets and block documents.

This package provides:

- persisted Python cell state schemas for code, inputs, outputs, requirements,
  execution policy, and bounded last-result summaries
- `createPythonCellSlice()` for durable cell state and runtime result updates
- a Pyodide worker runtime adapter with SQLRooms host-query bridge support
- `PythonCellBlock` and `createPythonCellBlockDefinition()` for embeddable
  worksheet/document blocks
- `createPythonCellCommands()` for command-backed create, update, run, and clear
  operations

If no runtime adapter is configured, running a cell records a bounded error
result instead of executing hidden Python.

## Store setup

```tsx
import {
  createPythonCellSlice,
  PythonCellSliceConfig,
  type PythonCellSliceState,
} from '@sqlrooms/python-cell';

type RoomState = PythonCellSliceState;

const sliceConfigSchemas = {
  pythonCells: PythonCellSliceConfig,
};

const storeSlices = {
  ...createPythonCellSlice()(set, get, store),
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

Pass the adapter to `createPythonCellSlice({runtimeAdapter: adapter})`.

The bundled Pyodide adapter captures the global `result` value, or the final
expression value when no `result` global is assigned. It returns JSON, text,
HTML, and Vega-Lite outputs when Python objects expose common rich-display
methods such as `_repr_mimebundle_()`, `_repr_html_()`, or Altair `to_dict()`.
HTML and Vega-Lite previews are rendered in sandboxed iframes by
`PythonCellBlock`.

When user code imports `altair`, the Pyodide worker installs Altair and
`vega_datasets` on demand through `micropip`. It also provides an
`altair.datasets` compatibility module backed by `vega_datasets.data` for
sample-code snippets that use `from altair.datasets import data`.

## Worksheet commands

Use `createPythonCellCommands({commandNamespace: 'worksheet'})` alongside the
worksheet block-document commands to expose:

- `worksheet.add-python-cell-block`
- `worksheet.update-python-cell-code`
- `worksheet.run-python-cell-block`
- `worksheet.clear-python-cell-result`
