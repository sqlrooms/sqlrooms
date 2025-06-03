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

### Complete Example

```tsx
import {useState} from 'react';
import {S3FileBrowser, S3CredentialForm, S3State} from '@sqlrooms/s3-browser';
import {S3FileOrDirectory, S3Config, S3Connection} from '@sqlrooms/s3';

type S3BrowserProps = {
  listS3Files: (args: {
    s3Config: S3Config;
    prefix: string;
  }) => Promise<S3FileOrDirectory[]>;
  loadS3Files: (args: {
    s3Config: S3Config;
    prefix: string;
    files: string[];
  }) => Promise<void>;
  s3: S3State['s3'];
  saveS3Credential: (s3Config: S3Config) => Promise<void>;
  loadS3Credentials: () => Promise<S3Connection[]>;
  deleteS3Credential: (id: string) => Promise<void>;
};

export const S3Browser = ({
  listS3Files,
  s3,
  loadS3Files,
  saveS3Credential,
  loadS3Credentials,
  deleteS3Credential,
}: S3BrowserProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<S3FileOrDirectory[] | null>(null);
  const [selectedDirectory, onChangeSelectedDirectory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const {setCurrentS3Config, clearCurrentS3Config, currentS3Config} = s3;

  const listFiles = async (s3Config: S3Config, prefix: string) => {
    try {
      const files = await listS3Files({
        s3Config,
        prefix,
      });
      setCurrentS3Config(s3Config);
      setFiles(files);
      setError('');
      onChangeSelectedDirectory(prefix);
    } catch (error) {
      setError((error as Error).message);
    }
    setIsConnecting(false);
  };

  const handleLoadFiles = async () => {
    if (!currentS3Config) return;
    await loadS3Files({
      s3Config: currentS3Config,
      prefix: selectedDirectory,
      files: selectedFiles,
    });
  };

  return (
    <div className="flex h-full flex-col items-center gap-4">
      {/* Connection Panel */}
      {!files ? (
        <S3CredentialForm
          onConnect={(values) => {
            setIsConnecting(true);
            listFiles(values, '');
          }}
          isLoading={isConnecting}
          saveS3Credential={saveS3Credential}
          loadS3Credentials={loadS3Credentials}
          deleteS3Credential={deleteS3Credential}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-start justify-start gap-2">
          <S3FileBrowser
            files={files}
            selectedFiles={selectedFiles}
            selectedDirectory={selectedDirectory}
            onChangeSelectedFiles={setSelectedFiles}
            onChangeSelectedDirectory={(directory) => {
              setIsConnecting(true);
              if (!currentS3Config) return;
              listFiles(currentS3Config, directory);
            }}
            onCanConfirmChange={() => {}}
          />
          <button disabled={!selectedFiles.length} onClick={handleLoadFiles}>
            Add Selected
          </button>
        </div>
      )}
    </div>
  );
};
```

This example demonstrates:

- Integrating both `S3FileBrowser` and `S3CredentialForm` components
- Managing S3 connection state
- Handling file listing and selection
- Error handling and loading states
- File loading functionality

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

### S3CredentialForm Component

The `S3CredentialForm` component provides a form interface for managing S3 credentials and saved connections.

```tsx
import {S3CredentialForm} from '@sqlrooms/s3-browser';
import {S3Config, S3Connection} from '@sqlrooms/s3';

function MyS3ConnectionManager() {
  const handleConnect = async (credentials: S3Config) => {
    try {
      // Use the credentials to establish connection
      console.log('Connecting with:', credentials);
      // Example: initializeS3Client(credentials);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleSaveCredential = async (config: S3Config) => {
    try {
      // Save credential to your storage (e.g., local storage, database)
      const savedCredential = await saveToStorage({
        ...config,
        id: generateId(),
        createdAt: new Date().toISOString(),
      });
      return savedCredential;
    } catch (error) {
      console.error('Failed to save credential:', error);
    }
  };

  const handleLoadCredentials = async (): Promise<S3Connection[]> => {
    try {
      // Load saved credentials from your storage
      const credentials = await loadFromStorage();
      return credentials;
    } catch (error) {
      console.error('Failed to load credentials:', error);
      return [];
    }
  };

  const handleDeleteCredential = async (id: string) => {
    try {
      // Delete credential from your storage
      await deleteFromStorage(id);
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  };

  return (
    <S3CredentialForm
      onConnect={handleConnect}
      isLoading={false}
      saveS3Credential={handleSaveCredential}
      loadS3Credentials={handleLoadCredentials}
      deleteS3Credential={handleDeleteCredential}
    />
  );
}
```

Features:

- Input fields for S3 credentials (access key, secret key, region, bucket)
- Option to save connections for later use
- Auto-fill from AWS CLI exports or credential process output
- Management of saved connections (view, connect, delete)
- Secure handling of sensitive credentials
- Support for session tokens (temporary credentials)

#### Props

```tsx
interface S3CredentialFormProps {
  /**
   * Callback fired when the connect button is clicked
   */
  onConnect: (data: S3Config) => void;

  /**
   * Loading state for the connect button
   */
  isLoading?: boolean;

  /**
   * Callback to save a new S3 credential
   */
  saveS3Credential: (data: S3Config) => Promise<void>;

  /**
   * Callback to load saved S3 credentials
   */
  loadS3Credentials: () => Promise<S3Connection[]>;

  /**
   * Optional callback to delete a saved credential
   */
  deleteS3Credential?: (id: string) => Promise<void>;
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

## Dependencies

- `react` ^18.0.0
- `react-dom` ^18.0.0
- `@sqlrooms/ui` - UI component library
- `@sqlrooms/utils` - Utility functions
- `@sqlrooms/s3` - S3 client and types
- `@hookform/resolvers` - Form validation resolvers
- `react-hook-form` - Form handling
- `zod` - Runtime type checking and validation
- `lucide-react` - Icon components
- `class-variance-authority` - Utility for managing component variants
- `clsx` - Utility for constructing className strings
- `tailwindcss` - CSS framework
