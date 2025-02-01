[@sqlrooms/utils](../index.md) / formatDateTime

# Function: formatDateTime()

> **formatDateTime**(`d`): `string`

Formats a date into a human-readable datetime string

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `d` | `number` \| `bigint` \| `Date` | Date to format (can be Date object, timestamp number, or bigint) |

## Returns

`string`

Formatted string in "Day YYYY-MM-DD HH:MM AM/PM" format

## Example

```ts
formatDateTime(new Date()); // e.g., "Wed 2024-03-13 02:30 PM"
```
