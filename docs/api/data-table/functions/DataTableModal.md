[@sqlrooms/data-table](../index.md) / DataTableModal

# Function: DataTableModal()

> **DataTableModal**(`props`, `deprecatedLegacyContext`?): `ReactNode`

A modal component for displaying a table with data from a SQL query.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `props` | \{ `title`: `undefined` \| `string`; `query`: `undefined` \| `string`; `tableModal`: \{ `isOpen`: `boolean`; `onClose`: () => `void`; \}; \} | Component props |
| `props.title` | `undefined` \| `string` | The title of the table |
| `props.query`? | `undefined` \| `string` | The SQL query to execute and display in the table |
| `props.tableModal`? | \{ `isOpen`: `boolean`; `onClose`: () => `void`; \} | An object containing the modal's open state and close function |
| `props.tableModal.isOpen`? | `boolean` | - |
| `props.tableModal.onClose`? | () => `void` | - |
| `deprecatedLegacyContext`? | `any` | **Deprecated** **See** [React Docs](https://legacy.reactjs.org/docs/legacy-context.html#referencing-context-in-lifecycle-methods) |

## Returns

`ReactNode`

## Component

## Example

```tsx
import { useState } from 'react';
import { DataTableModal } from '@sqlrooms/data-table';

const MyComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DataTableModal
      title="Users"
      query="SELECT * FROM users LIMIT 10"
      tableModal={{
        isOpen,
        onClose: () => setIsOpen(false)
      }}
    />
  );
};
```
