Python cell blocks for SQLRooms worksheets and block documents.

This package provides:

- persisted Python cell state schemas for code, inputs, outputs, requirements,
  execution policy, and bounded last-result summaries
- `createPythonCellSlice()` for durable cell state and runtime result updates
- runtime adapter and host interfaces that keep Pyodide behind a generic Python
  execution boundary
- `PythonCellBlock` and `createPythonCellBlockDefinition()` for embeddable
  worksheet/document blocks
- `createPythonCellCommands()` for command-backed create, update, run, and clear
  operations

The first implementation intentionally does not bundle a Pyodide worker. If no
runtime adapter is configured, running a cell records a bounded error result
instead of executing hidden Python.

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

## Worksheet commands

Use `createPythonCellCommands({commandNamespace: 'worksheet'})` alongside the
worksheet block-document commands to expose:

- `worksheet.add-python-cell-block`
- `worksheet.update-python-cell-code`
- `worksheet.run-python-cell-block`
- `worksheet.clear-python-cell-result`
