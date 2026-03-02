import React, {useMemo} from 'react';
import {CodeMirrorEditor, CodeMirrorEditorProps} from './CodeMirrorEditor';
import {lintGutter} from '@codemirror/lint';
import {jsonSchemaLinter} from '../extensions/json-schema-lint';
import {jsonSchemaAutocomplete} from '../extensions/json-schema-autocomplete';
import {autoTriggerOnQuote} from '../extensions/auto-trigger';
import {json} from '@codemirror/lang-json';
import {createJsonTheme} from '../themes/json-theme';
import {Theme, useIsDarkTheme} from '@sqlrooms/ui';

export interface JsonCodeMirrorEditorProps extends Omit<
  CodeMirrorEditorProps,
  'value'
> {
  /** The JSON schema to validate against */
  schema?: object;
  /** The JSON value to edit - can be a string or an object (will be stringified) */
  value?: string | object;
  /** Optional theme override (defaults to auto-detect) */
  theme?: Theme;
}

/** A CodeMirror editor for editing JSON with schema validation and autocomplete */
export const JsonCodeMirrorEditor: React.FC<JsonCodeMirrorEditorProps> = ({
  schema,
  value = '',
  extensions: userExtensions = [],
  options = {},
  theme: explicitTheme,
  ...props
}) => {
  // Convert object value to string if needed
  const stringValue =
    typeof value === 'object' ? JSON.stringify(value, null, 2) : value;

  const isDark = useIsDarkTheme(explicitTheme);

  // Build JSON-specific extensions
  const extensions = useMemo(() => {
    return [
      json(),
      createJsonTheme(isDark),
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
  }, [schema, userExtensions, isDark]);

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
