[@sqlrooms/utils](../index.md) / convertToUniqueS3ObjectName

# Function: convertToUniqueS3ObjectName()

> **convertToUniqueS3ObjectName**(`str`, `existingObjects`?): `string`

Converts a string into a valid and unique S3 object name.
- Replaces special characters with underscores
- Ensures name is within S3's length limits
- Ensures uniqueness among existing objects

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `str` | `string` | The string to convert into an S3 object name |
| `existingObjects`? | `string`[] | Optional array of existing S3 object names to ensure uniqueness |

## Returns

`string`

A valid and unique S3 object name

## Example

```ts
convertToUniqueS3ObjectName("my file.txt") // returns "my_file.txt"
```
