This package is part of the SQLRooms framework.

# S3

A utilities for calling S3-compatible storage services. To be used with s3-browser

## Features

- S3 utility functions for listing and deleting files

## Installation

```bash
npm install @sqlrooms/s3
# or
yarn add @sqlrooms/s3
```

### S3 Utility Functions

The package also provides utility functions for working with S3:

```tsx
import {S3Client} from '@aws-sdk/client-s3';
import {listFilesAndDirectoriesWithPrefix} from '@sqlrooms/s3';

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
- zod
