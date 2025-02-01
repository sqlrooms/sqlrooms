[@sqlrooms/utils](../index.md) / formatBytes

# Function: formatBytes()

> **formatBytes**(`bytes`): `string`

Formats a number of bytes into a human-readable string with appropriate size units.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `bytes` | `number` | The number of bytes to format |

## Returns

`string`

A string representation of the bytes with appropriate unit (Bytes, KB, MB, etc.)

## Example

```ts
formatBytes(1024) // returns "1 KB"
formatBytes(1234567) // returns "1.18 MB"
```
