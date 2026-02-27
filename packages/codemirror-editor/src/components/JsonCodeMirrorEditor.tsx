import React, {useMemo} from 'react';
import {CodeMirrorEditor, CodeMirrorEditorProps} from './CodeMirrorEditor';
import {lintGutter} from '@codemirror/lint';
import {jsonSchemaLinter} from '../extensions/json-schema-lint';
import {jsonSchemaAutocomplete} from '../extensions/json-schema-autocomplete';
import {autoTriggerOnQuote} from '../extensions/auto-trigger';

export interface JsonCodeMirrorEditorProps extends Omit<
  CodeMirrorEditorProps,
  'language' | 'value'
> {
  /**
   * The JSON schema to validate against
   */
  schema?: object;
  /**
   * The JSON value to edit
   * Can be a string or an object (will be stringified)
   */
  value?: string | object;
}

/**
 * A CodeMirror editor for editing JSON with schema validation and autocomplete
 * Equivalent to JsonMonacoEditor but using CodeMirror
 */
export const JsonCodeMirrorEditor: React.FC<JsonCodeMirrorEditorProps> = ({
  schema,
  value = '',
  extensions: userExtensions = [],
  options = {},
  ...props
}) => {
  // Convert object value to string if needed
  const stringValue =
    typeof value === 'object' ? JSON.stringify(value, null, 2) : value;

  // Build JSON-specific extensions
  const extensions = useMemo(() => {
    return [
      ...(schema
        ? [
            jsonSchemaLinter(schema),
            jsonSchemaAutocomplete(schema),
            lintGutter(),
          ]
        : []),
      autoTriggerOnQuote(),
      ...userExtensions,
    ];
  }, [schema, userExtensions]);

  return (
    <CodeMirrorEditor
      language="json"
      value={stringValue}
      extensions={extensions}
      options={{
        lineNumbers: options.lineNumbers ?? false,
        lineWrapping: options.lineWrapping ?? true,
        autocompletion: true,
        foldGutter: options.foldGutter ?? false,
        ...options,
      }}
      {...props}
    />
  );
};
