[@sqlrooms/utils](../index.md) / getErrorMessageForDisplay

# Function: getErrorMessageForDisplay()

> **getErrorMessageForDisplay**(`e`): `string`

Extracts and formats an error message for display, removing common prefixes and truncating at first newline

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `e` | `unknown` | Error object or any other value that can be converted to string |

## Returns

`string`

Cleaned up error message string

## Example

```ts
getErrorMessageForDisplay(new Error("Query failed: Error: Invalid syntax\nMore details...")); // "Invalid syntax"
```
