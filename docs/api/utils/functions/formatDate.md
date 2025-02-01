[@sqlrooms/utils](../index.md) / formatDate

# Function: formatDate()

> **formatDate**(`d`): `string`

Formats a date into YYYY-MM-DD format

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `d` | `number` \| `bigint` \| `Date` | Date to format (can be Date object, timestamp number, or bigint) |

## Returns

`string`

Formatted date string

## Example

```ts
formatDate(new Date()); // e.g., "2024-03-13"
```
