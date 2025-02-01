[@sqlrooms/duckdb](../index.md) / DuckQueryError

# Class: DuckQueryError

## Extends

- `Error`

## Constructors

### new DuckQueryError()

> **new DuckQueryError**(`err`, `query`, `stack`): [`DuckQueryError`](DuckQueryError.md)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `err` | `unknown` |
| `query` | `string` |
| `stack` | `undefined` \| `string` |

#### Returns

[`DuckQueryError`](DuckQueryError.md)

#### Overrides

`Error.constructor`

## Properties

| Property | Modifier | Type | Overrides |
| ------ | ------ | ------ | ------ |
| <a id="cause"></a> `cause` | `readonly` | `unknown` | `Error.cause` |
| <a id="query-1"></a> `query` | `readonly` | `undefined` \| `string` | - |
| <a id="querycallstack"></a> `queryCallStack` | `readonly` | `undefined` \| `string` | - |

## Methods

### getMessageForUser()

> **getMessageForUser**(): `string`

#### Returns

`string`
