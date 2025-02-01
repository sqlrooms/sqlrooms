[@sqlrooms/utils](../index.md) / convertToUniqueS3FolderPath

# Function: convertToUniqueS3FolderPath()

> **convertToUniqueS3FolderPath**(`str`, `existingObjects`?): `string`

Converts a string into a valid and unique S3 folder path.
- Ensures the path ends with a forward slash
- Replaces special characters with underscores
- Ensures uniqueness among existing paths

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `str` | `string` | The string to convert into an S3 folder path |
| `existingObjects`? | `string`[] | Optional array of existing S3 paths to ensure uniqueness |

## Returns

`string`

A valid and unique S3 folder path ending with a forward slash

## Example

```ts
convertToUniqueS3FolderPath("my folder") // returns "my_folder/"
```
