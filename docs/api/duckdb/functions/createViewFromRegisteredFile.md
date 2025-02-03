[@sqlrooms/duckdb](../index.md) / createViewFromRegisteredFile

# Function: createViewFromRegisteredFile()

> **createViewFromRegisteredFile**(`filePath`, `schema`, `tableName`, `opts`?): `Promise`\<\{ `tableName`: `string`; `rowCount`: `number`; \}\>

Create a view from a registered file.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | The path to the file to create the view from. |
| `schema` | `string` | The schema to create the view in. |
| `tableName` | `string` | The name of the table to create. |
| `opts`? | \{ `mode`: `"table"` \| `"view"`; \} | The options to create the view with. |
| `opts.mode`? | `"table"` \| `"view"` | - |

## Returns

`Promise`\<\{ `tableName`: `string`; `rowCount`: `number`; \}\>

The view that was created.
