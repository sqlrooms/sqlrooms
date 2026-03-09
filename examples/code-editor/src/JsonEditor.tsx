import React, {useState} from 'react';
import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {type EditorType} from './EditorTypeSwitch';

// Example JSON schema for a user profile
const userProfileSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Full name of the user',
      minLength: 2,
      maxLength: 50,
    },
    email: {
      type: 'string',
      description: 'Email address',
      format: 'email',
    },
    age: {
      type: 'number',
      description: 'Age in years',
      minimum: 18,
      maximum: 120,
    },
    status: {
      type: 'string',
      description: 'Account status',
      enum: ['active', 'inactive', 'pending', 'suspended'],
    },
    premium: {
      type: 'boolean',
      description: 'Premium membership status',
    },
    settings: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'auto'],
        },
        notifications: {
          type: 'boolean',
        },
      },
      required: ['theme'],
    },
  },
  required: ['name', 'email', 'status'],
};

// Example initial JSON data
const initialData = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 28,
  status: 'active',
  premium: true,
  settings: {
    theme: 'dark',
    notifications: true,
  },
};

interface JsonEditorProps {
  editorType: EditorType;
  className?: string;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  editorType,
  className,
}) => {
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(initialData, null, 2),
  );
  if (editorType === 'monaco') {
    return (
      <JsonMonacoEditor
        schema={userProfileSchema}
        value={jsonValue}
        onChange={(value) => setJsonValue(value || '')}
        className={className}
        options={{
          minimap: {enabled: false},
          lineNumbers: 'on',
          wordWrap: 'on',
        }}
      />
    );
  }

  return (
    <JsonCodeMirrorEditor
      schema={userProfileSchema}
      value={jsonValue}
      onChange={(value) => setJsonValue(value)}
      className={className}
      options={{
        lineNumbers: true,
        lineWrapping: true,
      }}
    />
  );
};
