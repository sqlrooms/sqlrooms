[@sqlrooms/utils](../index.md) / convertToUniqueColumnOrTableName

# Function: convertToUniqueColumnOrTableName()

> **convertToUniqueColumnOrTableName**(`filename`, `existingTables`?): `string`

Converts a filename into a valid and unique column or table name for database use.
- Removes file extension
- Replaces invalid characters with underscores
- Ensures the name starts with a letter or underscore
- Truncates to max length of 63 characters
- Ensures uniqueness among existing names

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filename` | `string` | The original filename to convert |
| `existingTables`? | `string`[] | Optional array of existing table names to ensure uniqueness |

## Returns

`string`

A valid and unique table/column name

## Example

```ts
convertToUniqueColumnOrTableName("my-file.csv") // returns "my_file"
convertToUniqueColumnOrTableName("123data.csv") // returns "_123data"
```
