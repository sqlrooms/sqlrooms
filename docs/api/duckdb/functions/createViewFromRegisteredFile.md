[@sqlrooms/duckdb](../index.md) / createViewFromRegisteredFile

# Function: createViewFromRegisteredFile()

> **createViewFromRegisteredFile**(`filePath`, `schema`, `tableName`, `opts`?): `Promise`\<\{ `tableName`: `string`; `rowCount`: `number`; \}\>

## Parameters

| Parameter | Type |
| ------ | ------ |
| `filePath` | `string` |
| `schema` | `string` |
| `tableName` | `string` |
| `opts`? | \{ `mode`: `"table"` \| `"view"`; \} |
| `opts.mode`? | `"table"` \| `"view"` |

## Returns

`Promise`\<\{ `tableName`: `string`; `rowCount`: `number`; \}\>
