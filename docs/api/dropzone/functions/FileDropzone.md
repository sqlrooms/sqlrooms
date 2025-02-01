[@sqlrooms/dropzone](../index.md) / FileDropzone

# Function: FileDropzone()

> **FileDropzone**(`props`, `deprecatedLegacyContext`?): `ReactNode`

A customizable file dropzone component that handles file uploads through drag-and-drop or click interactions.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `props` | \{ `className`: `string`; `isInvalid`: `boolean`; `onDrop`: (`files`) => `Promise`\<`void`\>; `multiple`: `boolean`; `acceptedFormats`: `Record`\<`string`, `string`[]\>; `children`: `ReactNode`; \} | Component props |
| `props.className`? | `string` | Optional CSS class name for styling |
| `props.isInvalid`? | `boolean` | Optional flag to indicate validation error state |
| `props.onDrop`? | (`files`) => `Promise`\<`void`\> | Async callback function called when files are dropped or selected |
| `props.multiple`? | `boolean` | Optional flag to allow multiple file selection (default: true) |
| `props.acceptedFormats`? | `Record`\<`string`, `string`[]\> | Optional object defining accepted MIME types and their extensions |
| `props.children`? | `ReactNode` | Optional React nodes to render inside the dropzone |
| `deprecatedLegacyContext`? | `any` | **Deprecated** **See** [React Docs](https://legacy.reactjs.org/docs/legacy-context.html#referencing-context-in-lifecycle-methods) |

## Returns

`ReactNode`

## Component

## Example

```tsx
// Basic usage
<FileDropzone
  onDrop={async (files) => {
    console.log('Dropped files:', files);
    // Handle file upload
  }}
/>

// With file type restrictions and single file upload
<FileDropzone
  multiple={false}
  acceptedFormats={{
    'text/csv': ['.csv'],
    'application/json': ['.json']
  }}
  onDrop={async (files) => {
    const file = files[0];
    // Handle single file upload
  }}
>
  <p>Custom dropzone content</p>
</FileDropzone>
```
