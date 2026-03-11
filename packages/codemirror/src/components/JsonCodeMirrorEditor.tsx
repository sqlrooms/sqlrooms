import React, {useMemo} from 'react';
import {CodeMirrorEditor, CodeMirrorEditorProps} from './CodeMirrorEditor';
import {lintGutter} from '@codemirror/lint';
import {jsonSchemaLinter} from '../extensions/json-schema-lint';
import {jsonSchemaAutocomplete} from '../extensions/json-schema-autocomplete';
import {autoTriggerOnQuote} from '../extensions/auto-trigger';
import {json} from '@codemirror/lang-json';
import {createJsonTheme} from '../themes/json-theme';

export interface JsonCodeMirrorEditorProps extends Omit<
  CodeMirrorEditorProps,
  'value'
> {
  /** The JSON schema to validate against */
  schema?: object;
  /** The JSON value to edit - can be a string or an object (will be stringified) */
  value?: string | object;

  /** Whether to hide the gutter (line numbers, fold markers, etc.) */
  hideGutter?: boolean;
}

/** A CodeMirror editor for editing JSON with schema validation and autocomplete */
export const JsonCodeMirrorEditor: React.FC<JsonCodeMirrorEditorProps> = ({
  schema,
  value = '',
  extensions: userExtensions = [],
  options = {},
  hideGutter,
  ...props
}) => {
  // Convert object value to string if needed
  const stringValue =
    typeof value === 'object' ? JSON.stringify(value, null, 2) : value;

  // Build JSON-specific extensions
  const extensions = useMemo(() => {
    return [
      json(),
      createJsonTheme({hideGutter}),
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
  }, [schema, userExtensions, hideGutter]);

  return (
    <CodeMirrorEditor
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
