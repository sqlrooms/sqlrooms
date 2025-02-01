[@sqlrooms/utils](../index.md) / generateUniquePath

# Function: generateUniquePath()

> **generateUniquePath**(`filePath`, `existingPaths`): `string`

Generates a unique file path by appending a numeric suffix if the path already exists.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | The original file path |
| `existingPaths` | `string`[] | Array of existing file paths to check against |

## Returns

`string`

A unique file path

## Example

```ts
generateUniquePath("file.txt", ["file.txt"]) // returns "file_1.txt"
```
