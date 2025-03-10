This package is part of the SQLRooms framework.

A flexible file upload component for SQLRooms applications that provides drag-and-drop functionality for files. This package makes it easy to handle file uploads with a modern, user-friendly interface.

## Features

- 📁 **Drag and Drop**: Intuitive drag-and-drop file upload interface
- 📋 **File Selection**: Traditional file selection dialog support
- 🔍 **File Validation**: Validate file types and sizes
- 📊 **Upload Progress**: Track and display upload progress
- 🎨 **Customizable**: Flexible styling and configuration options
- 🧩 **React Integration**: Seamless integration with React applications

## Installation

```bash
npm install @sqlrooms/dropzone
# or
yarn add @sqlrooms/dropzone
```

## Basic Usage

### Simple File Dropzone

```tsx
import {FileDropzone} from '@sqlrooms/dropzone';

function MyFileUploader() {
  const handleFileDrop = (files) => {
    console.log('Files dropped:', files);
    // Process the files...
  };

  return (
    <FileDropzone
      onFileDrop={handleFileDrop}
      accept=".csv,.json,.xlsx"
      maxSize={10 * 1024 * 1024} // 10MB
    />
  );
}
```

### With Custom Styling

```tsx
import {FileDropzone} from '@sqlrooms/dropzone';

function CustomStyledDropzone() {
  return (
    <FileDropzone
      onFileDrop={handleFiles}
      className="rounded-lg border-2 border-dashed border-blue-400 p-8 transition-colors hover:border-blue-600"
      activeClassName="border-green-500 bg-green-50"
      rejectClassName="border-red-500 bg-red-50"
      dragMessage="Drop your files here"
      idleMessage="Drag files or click to upload"
      rejectMessage="File type not supported"
    />
  );
}
```

### With File Type Validation

```tsx
import {FileDropzone} from '@sqlrooms/dropzone';

function DataFileUploader() {
  const handleFileDrop = (files) => {
    // Process data files...
  };

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-2 text-xl font-bold">Upload Data Files</h2>
      <p className="mb-4 text-gray-600">
        Supported formats: CSV, JSON, Excel, Parquet
      </p>
      <FileDropzone
        onFileDrop={handleFileDrop}
        accept={{
          'text/csv': ['.csv'],
          'application/json': ['.json'],
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
            '.xlsx',
          ],
          'application/octet-stream': ['.parquet'],
        }}
        maxFiles={5}
        maxSize={50 * 1024 * 1024} // 50MB
      />
    </div>
  );
}
```

## Advanced Features

- **Multiple File Upload**: Support for uploading multiple files at once
- **File Preview**: Preview files before uploading
- **Custom Validation**: Define custom validation rules for files
- **Upload Cancellation**: Cancel ongoing uploads
- **Accessibility**: Fully accessible interface with keyboard support

For more information, visit the SQLRooms documentation.
