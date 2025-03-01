import React from 'react';
import {MonacoEditor, MonacoEditorProps} from './MonacoEditor';
import {OnMount} from '@monaco-editor/react';

export interface JsonMonacoEditorProps
  extends Omit<MonacoEditorProps, 'language' | 'value'> {
  /**
   * The JSON schema to validate against
   */
  schema?: object;
  /**
   * The JSON value to edit
   */
  value?: string | object;
}

/**
 * A Monaco editor for editing JSON with schema validation
 */
export const JsonMonacoEditor: React.FC<JsonMonacoEditorProps> = ({
  schema,
  value = '',
  onMount,
  className,
  ...props
}) => {
  // Convert object value to string if needed
  const stringValue =
    typeof value === 'object' ? JSON.stringify(value, null, 2) : value;

  // Handle editor mounting to configure JSON schema
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    if (schema) {
      // Configure JSON schema validation
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [
          {
            uri: 'http://myserver/schema.json',
            fileMatch: ['*'],
            schema: schema as any,
          },
        ],
      });
    }

    // Format the document on initial load
    setTimeout(() => {
      editor.getAction('editor.action.formatDocument')?.run();
    }, 100);

    // Call the original onMount if provided
    if (onMount) {
      onMount(editor, monaco);
    }
  };

  return (
    <MonacoEditor
      language="json"
      value={stringValue}
      onMount={handleEditorDidMount}
      className={className}
      options={{
        formatOnPaste: true,
        formatOnType: true,
      }}
      {...props}
    />
  );
};
