[@sqlrooms/data-table](../globals.md) / DataTablePaginatedProps

# Type Alias: DataTablePaginatedProps\<Data\>

> **DataTablePaginatedProps**\<`Data`\>: `object`

## Type Parameters

| Type Parameter |
| ------ |
| `Data` *extends* `object` |

## Type declaration

| Name | Type |
| ------ | ------ |
| <a id="data"></a> `data`? | `ArrayLike`\<`Data`\> |
| <a id="columns"></a> `columns`? | `ColumnDef`\<`Data`, `any`\>[] |
| <a id="pagecount"></a> `pageCount`? | `number` |
| <a id="numrows"></a> `numRows`? | `number` |
| <a id="isfetching"></a> `isFetching`? | `boolean` |
| <a id="isexporting"></a> `isExporting`? | `boolean` |
| <a id="pagination"></a> `pagination`? | `PaginationState` |
| <a id="sorting"></a> `sorting`? | `SortingState` |
| <a id="onpaginationchange"></a> `onPaginationChange`? | (`pagination`) => `void` |
| <a id="onsortingchange"></a> `onSortingChange`? | (`sorting`) => `void` |
| <a id="onexport"></a> `onExport`? | () => `void` |
