[@sqlrooms/utils](../index.md) / formatTimeOfDay

# Function: formatTimeOfDay()

> **formatTimeOfDay**(`d`): `string`

Formats a date into time of day (HH:MM AM/PM)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `d` | `number` \| `bigint` \| `Date` | Date to format (can be Date object, timestamp number, or bigint) |

## Returns

`string`

Formatted time string

## Example

```ts
formatTimeOfDay(new Date()); // e.g., "02:30 PM"
```
