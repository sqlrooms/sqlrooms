A high-performance data table component library for SQLRooms applications. This package provides flexible and feature-rich table components for displaying and interacting with large datasets, with special support for Apache Arrow data structures.

## Features

- 📊 **Multiple Table Variants**: Paginated, virtualized, and query-specific tables
- 🚀 **High Performance**: Optimized for handling large datasets efficiently
- 🏹 **Arrow Integration**: Native support for Apache Arrow data structures
- 🔍 **Sorting & Filtering**: Built-in data manipulation capabilities
- 📱 **Responsive Design**: Tables that work well on all screen sizes
- 🎨 **Customizable**: Flexible styling and configuration options

## Installation

```bash
npm install @sqlrooms/data-table
# or
yarn add @sqlrooms/data-table
```

## Basic Usage

### Paginated Data Table

```tsx
import {DataTablePaginated} from '@sqlrooms/data-table';

function MyDataTable() {
  const data = [
    {id: 1, name: 'Alice', age: 28},
    {id: 2, name: 'Bob', age: 34},
    {id: 3, name: 'Charlie', age: 42},
    // More data...
  ];

  const columns = [
    {accessorKey: 'id', header: 'ID'},
    {accessorKey: 'name', header: 'Name'},
    {accessorKey: 'age', header: 'Age'},
  ];

  return (
    <DataTablePaginated
      data={data}
      columns={columns}
      pageSize={10}
      enableSorting
      enableFiltering
    />
  );
}
```

### Virtualized Data Table for Large Datasets

```tsx
import {DataTableVirtualized} from '@sqlrooms/data-table';

function LargeDataTable() {
  // Imagine this is a very large dataset
  const largeDataset = generateLargeDataset(10000);

  const columns = [
    {accessorKey: 'id', header: 'ID'},
    {accessorKey: 'name', header: 'Name'},
    {accessorKey: 'email', header: 'Email'},
    {accessorKey: 'status', header: 'Status'},
    {accessorKey: 'lastActive', header: 'Last Active'},
  ];

  return (
    <DataTableVirtualized
      data={largeDataset}
      columns={columns}
      height={500}
      width="100%"
    />
  );
}
```

### Working with SQL Query Results

```tsx
import {QueryDataTable} from '@sqlrooms/data-table';
import {useSql} from '@sqlrooms/duckdb';

function QueryResultsTable() {
  const {data, isLoading, error} = useSql({
    query:
      'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC',
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return <QueryDataTable data={data} />;
}
```

### Using with Apache Arrow

```tsx
import {useArrowDataTable} from '@sqlrooms/data-table';
import {Table} from 'apache-arrow';

function ArrowTable({arrowTable}: {arrowTable: Table}) {
  const {columns, data} = useArrowDataTable(arrowTable);

  return <DataTablePaginated columns={columns} data={data} pageSize={25} />;
}
```

## Advanced Features

- **Custom Cell Rendering**: Define custom renderers for specific cell types
- **Row Selection**: Enable row selection with checkboxes
- **Expandable Rows**: Show additional details in expandable row sections
- **Column Resizing**: Allow users to resize columns
- **Export Options**: Export table data to CSV or other formats
- **Theming**: Customize the appearance to match your application

For more information, visit the SQLRooms documentation.
