[@sqlrooms/utils](../index.md) / generateUniqueName

# Function: generateUniqueName()

> **generateUniqueName**(`name`, `usedNames`?): `string`

Generates a unique name by appending a numeric suffix if the name already exists.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `name` | `string` | The base name to make unique |
| `usedNames`? | `string`[] | Optional array of existing names to check against |

## Returns

`string`

A unique name, potentially with a numeric suffix

## Example

```ts
generateUniqueName("table", ["table"]) // returns "table_1"
generateUniqueName("table_1", ["table_1"]) // returns "table_2"
```
