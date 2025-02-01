[@sqlrooms/utils](../index.md) / camelCaseToTitle

# Function: camelCaseToTitle()

> **camelCaseToTitle**(`camelCase`): `string`

Converts a camelCase string into a Title Case string.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `camelCase` | `string` | The camelCase string to convert |

## Returns

`string`

A Title Case string with spaces between words

## Example

```ts
camelCaseToTitle("myVariableName") // returns "My Variable Name"
camelCaseToTitle("URL") // returns "URL"
```
