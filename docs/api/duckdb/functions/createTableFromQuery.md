[@sqlrooms/duckdb](../index.md) / createTableFromQuery

# Function: createTableFromQuery()

> **createTableFromQuery**(`tableName`, `query`): `Promise`\<\{ `tableName`: `string`; `rowCount`: `number`; \}\>

Create a table from a query.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `tableName` | `string` | The name of the table to create. |
| `query` | `string` | The query to create the table from. |

## Returns

`Promise`\<\{ `tableName`: `string`; `rowCount`: `number`; \}\>

The table that was created.
