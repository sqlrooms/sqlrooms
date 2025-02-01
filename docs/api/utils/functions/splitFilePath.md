[@sqlrooms/utils](../index.md) / splitFilePath

# Function: splitFilePath()

> **splitFilePath**(`filePath`): `object`

Splits a file path into its directory, name, and extension components.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `filePath` | `string` | The full file path to split |

## Returns

`object`

An object containing the directory path, file name (without extension), and extension

| Name | Type |
| ------ | ------ |
| <a id="dir"></a> `dir` | `string` |
| <a id="name"></a> `name` | `string` |
| <a id="ext"></a> `ext` | `string` |

## Example

```ts
splitFilePath("path/to/file.txt") // returns { dir: "path/to", name: "file", ext: "txt" }
```
