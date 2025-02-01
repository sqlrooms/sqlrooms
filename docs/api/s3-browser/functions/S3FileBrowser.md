[@sqlrooms/s3-browser](../index.md) / S3FileBrowser

# Function: S3FileBrowser()

> **S3FileBrowser**(`props`, `deprecatedLegacyContext`?): `ReactNode`

A file browser component for navigating and selecting files from an S3-like storage.

This component provides a familiar file explorer interface with features like:
- Directory navigation with breadcrumbs
- File and directory listing
- Multiple file selection
- File metadata display (size, type, last modified)

![S3 File Browser Interface](https://github.com/user-attachments/assets/dd79fbb9-c487-4050-96ef-81cff39930d3)

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `props` | \{ `files`: (\{ `key`: `string`; `isDirectory`: `true`; \} \| \{ `key`: `string`; `isDirectory`: `false`; `lastModified`: `Date`; `size`: `number`; `contentType`: `string`; \})[]; `selectedFiles`: `string`[]; `selectedDirectory`: `string`; `onCanConfirmChange`: (`canConfirm`) => `void`; `onChangeSelectedDirectory`: (`directory`) => `void`; `onChangeSelectedFiles`: (`files`) => `void`; \} | The component props |
| `props.files`? | (\{ `key`: `string`; `isDirectory`: `true`; \} \| \{ `key`: `string`; `isDirectory`: `false`; `lastModified`: `Date`; `size`: `number`; `contentType`: `string`; \})[] | Array of files and directories to display |
| `props.selectedFiles`? | `string`[] | Array of currently selected file keys |
| `props.selectedDirectory`? | `string` | Current directory path (empty string for root) |
| `props.onCanConfirmChange`? | (`canConfirm`) => `void` | Callback fired when selection state changes |
| `props.onChangeSelectedDirectory`? | (`directory`) => `void` | Callback fired when directory navigation occurs |
| `props.onChangeSelectedFiles`? | (`files`) => `void` | Callback fired when file selection changes |
| `deprecatedLegacyContext`? | `any` | **Deprecated** **See** [React Docs](https://legacy.reactjs.org/docs/legacy-context.html#referencing-context-in-lifecycle-methods) |

## Returns

`ReactNode`

## Example

```tsx
const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
const [selectedDirectory, setSelectedDirectory] = useState('');

return (
  <S3FileBrowser
    files={[
      { key: 'documents', isDirectory: true },
      {
        key: 'example.txt',
        isDirectory: false,
        size: 1024,
        contentType: 'text/plain',
        lastModified: new Date()
      }
    ]}
    selectedFiles={selectedFiles}
    selectedDirectory={selectedDirectory}
    onCanConfirmChange={(canConfirm) => console.log('Can confirm:', canConfirm)}
    onChangeSelectedDirectory={setSelectedDirectory}
    onChangeSelectedFiles={setSelectedFiles}
  />
);
```
