React components for rendering DuckDB database/schema/table/column trees in SQLRooms apps.

## Installation

```bash
npm install @sqlrooms/schema-tree @sqlrooms/duckdb @sqlrooms/ui
```

## What this package provides

- `TableSchemaTree` for rendering full schema hierarchies
- node components (`DatabaseTreeNode`, `SchemaTreeNode`, `TableTreeNode`, `ColumnTreeNode`)
- `TreeNodeActionsMenu` for context-style node actions
- `defaultRenderTableSchemaNode` for quick customization

## Basic usage

```tsx
import {TableSchemaTree} from '@sqlrooms/schema-tree';
import {useRoomStore} from './store';

export function SchemaExplorer() {
  const schemaTrees = useRoomStore((state) => state.db.schemaTrees ?? []);

  if (!schemaTrees.length) {
    return <div className="p-2 text-sm">No schema loaded yet.</div>;
  }

  return (
    <TableSchemaTree
      className="h-full"
      schemaTrees={schemaTrees}
      skipSingleDatabaseOrSchema
    />
  );
}
```

## Custom node rendering

```tsx
import {DbSchemaNode} from '@sqlrooms/duckdb';
import {defaultRenderTableSchemaNode, TableSchemaTree} from '@sqlrooms/schema-tree';

const renderNode = (node: DbSchemaNode, isOpen: boolean) => (
  <div className={isOpen ? 'opacity-100' : 'opacity-90'}>
    {defaultRenderTableSchemaNode(node)}
  </div>
);

<TableSchemaTree schemaTrees={schemaTrees} renderNode={renderNode} />;
```

## Notes

- `schemaTrees` comes from the DuckDB slice (`state.db.schemaTrees`).
- Call `state.db.refreshTableSchemas()` after table changes to keep the tree up to date.
- This package is used by SQLRooms SQL editor table-structure panels.
