[@sqlrooms/duckdb](../index.md) / createViewFromFile

# Function: createViewFromFile()

> **createViewFromFile**(`filePath`, `schema`, `tableName`, `file`): `Promise`\<\{ `tableName`: `string`; `rowCount`: `number`; \}\>

Create a view from a file.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | The path to the file to create the view from. |
| `schema` | `string` | The schema to create the view in. |
| `tableName` | `string` | The name of the table to create. |
| `file` | `File` \| `Uint8Array` | The file to create the view from. |

## Returns

`Promise`\<\{ `tableName`: `string`; `rowCount`: `number`; \}\>
