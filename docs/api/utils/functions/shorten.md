[@sqlrooms/utils](../index.md) / shorten

# Function: shorten()

> **shorten**(`str`, `maxLength`): `string`

Shortens a string to a specified maximum length by truncating and adding an ellipsis.

## Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `str` | `string` | `undefined` | The string to shorten |
| `maxLength` | `number` | `10` | Maximum length of the resulting string (including ellipsis). Defaults to 10. |

## Returns

`string`

The shortened string with ellipsis if truncated, or the original string if shorter than maxLength

## Example

```ts
shorten("Hello World", 8) // Returns "Hello..."
shorten("Hi", 8) // Returns "Hi"
```
