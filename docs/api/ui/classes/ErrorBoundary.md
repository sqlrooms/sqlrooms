[@sqlrooms/ui](../index.md) / ErrorBoundary

# Class: ErrorBoundary

## Extends

- `Component`\<`Props`, `State`\>

## Constructors

### new ErrorBoundary()

> **new ErrorBoundary**(`props`): [`ErrorBoundary`](ErrorBoundary.md)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `props` | `Props` |

#### Returns

[`ErrorBoundary`](ErrorBoundary.md)

#### Inherited from

`Component<Props, State>.constructor`

### new ErrorBoundary()

> **new ErrorBoundary**(`props`, `context`): [`ErrorBoundary`](ErrorBoundary.md)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `props` | `Props` |
| `context` | `any` |

#### Returns

[`ErrorBoundary`](ErrorBoundary.md)

#### Deprecated

#### See

[React Docs](https://legacy.reactjs.org/docs/legacy-context.html)

#### Inherited from

`Component<Props, State>.constructor`

## Properties

| Property | Modifier | Type | Overrides |
| ------ | ------ | ------ | ------ |
| <a id="state"></a> `state` | `public` | `State` | `Component.state` |

## Methods

### getDerivedStateFromError()

> `static` **getDerivedStateFromError**(`error`): `State`

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `Error` |

#### Returns

`State`

***

### componentDidCatch()

> **componentDidCatch**(`error`, `errorInfo`): `void`

Catches exceptions generated in descendant components. Unhandled exceptions will cause
the entire component tree to unmount.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `error` | `Error` |
| `errorInfo` | `ErrorInfo` |

#### Returns

`void`

#### Overrides

`Component.componentDidCatch`

***

### render()

> **render**(): `undefined` \| `null` \| `string` \| `number` \| `boolean` \| `Iterable`\<`ReactNode`\> \| `Element`

#### Returns

`undefined` \| `null` \| `string` \| `number` \| `boolean` \| `Iterable`\<`ReactNode`\> \| `Element`

#### Overrides

`Component.render`
