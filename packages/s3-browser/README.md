This package is part of the SQLRooms framework.

# S3 Browser

A React component library for browsing and interacting with S3-compatible storage services.

![S3 File Browser Interface](https://github.com/user-attachments/assets/dd79fbb9-c487-4050-96ef-81cff39930d3)

## Features

- Directory navigation with breadcrumbs
- File and directory listing
- Multiple file selection
- File metadata display (size, type, last modified)
- S3 utility functions for listing and deleting files

## Installation

```bash
npm install @sqlrooms/s3-browser
# or
yarn add @sqlrooms/s3-browser
```

## Usage

### S3FileBrowser Component

The `S3FileBrowser` component provides a familiar file explorer interface for navigating and selecting files from an S3-like storage.

```tsx
import {S3FileBrowser} from '@sqlrooms/s3-browser';
import {useState} from 'react';

function MyS3Browser() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState('');

  return (
    <S3FileBrowser
      files={[
        {key: 'documents', isDirectory: true},
        {
          key: 'example.txt',
          isDirectory: false,
          size: 1024,
          contentType: 'text/plain',
          lastModified: new Date(),
        },
      ]}
      selectedFiles={selectedFiles}
      selectedDirectory={selectedDirectory}
      onCanConfirmChange={(canConfirm) =>
        console.log('Can confirm:', canConfirm)
      }
      onChangeSelectedDirectory={setSelectedDirectory}
      onChangeSelectedFiles={setSelectedFiles}
    />
  );
}
```

### S3 Utility Functions

The package also provides utility functions for working with S3:

```tsx
import {S3Client} from '@aws-sdk/client-s3';
import {
  listFilesAndDirectoriesWithPrefix,
  deleteS3Files,
} from '@sqlrooms/s3-browser';

// Initialize S3 client
const s3Client = new S3Client({region: 'us-east-1'});

// List files and directories
async function listFiles() {
  const files = await listFilesAndDirectoriesWithPrefix(
    s3Client,
    'my-bucket',
    'path/to/directory',
  );
  console.log(files);
}

// Delete files with a prefix
async function deleteFiles() {
  await deleteS3Files(s3Client, 'my-bucket', 'path/to/delete');
}
```

## API Reference

### S3FileBrowser

```tsx
interface S3FileBrowserProps {
  /**
   * Array of files and directories to display
   */
  files?: S3FileOrDirectory[];

  /**
   * Array of currently selected file keys
   */
  selectedFiles: string[];

  /**
   * Current directory path (empty string for root)
   */
  selectedDirectory: string;

  /**
   * Callback fired when selection state changes
   */
  onCanConfirmChange: (canConfirm: boolean) => void;

  /**
   * Callback fired when directory navigation occurs
   */
  onChangeSelectedDirectory: (directory: string) => void;

  /**
   * Callback fired when file selection changes
   */
  onChangeSelectedFiles: (files: string[]) => void;
}
```

### S3FileOrDirectory

```tsx
type S3FileOrDirectory =
  | {
      key: string;
      isDirectory: true;
    }
  | {
      key: string;
      isDirectory: false;
      lastModified?: Date;
      size?: number;
      contentType?: string;
    };
```

### Utility Functions

```tsx
/**
 * Lists files and directories with a given prefix
 */
function listFilesAndDirectoriesWithPrefix(
  S3: S3Client,
  bucket: string,
  prefix?: string,
): Promise<S3FileOrDirectory[]>;

/**
 * Delete all files with the given prefix
 */
function deleteS3Files(
  S3: S3Client,
  bucket: string,
  prefix: string,
): Promise<void>;
```

## Dependencies

- @aws-sdk/client-s3
- React
- @sqlrooms/ui (for UI components)
- @sqlrooms/utils (for formatting utilities)
- zod (for type validation)
