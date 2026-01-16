import type {OnMount} from '@monaco-editor/react';
import {MonacoEditor, MonacoEditorProps} from '@sqlrooms/monaco-editor';
import React, {useEffect, useRef} from 'react';
import {loadVegaLiteSchema} from '../schema/vegaLiteSchema';

export interface VegaMonacoEditorProps extends Omit<
  MonacoEditorProps,
  'language'
> {
  /**
   * Whether to enable Vega-Lite JSON schema validation
   * @default true
   */
  enableSchemaValidation?: boolean;
}

/**
 * A Monaco editor specialized for editing Vega-Lite specifications.
 * Automatically loads and configures the Vega-Lite JSON schema for validation.
 */
export const VegaMonacoEditor: React.FC<VegaMonacoEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  className,
  enableSchemaValidation = true,
  onMount,
  options,
  ...props
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  const schemaConfiguredRef = useRef(false);

  // Load and configure schema
  useEffect(() => {
    if (
      enableSchemaValidation &&
      monacoRef.current &&
      !schemaConfiguredRef.current
    ) {
      loadVegaLiteSchema().then((schema) => {
        if (monacoRef.current && schema) {
          configureJsonSchema(monacoRef.current, schema);
          schemaConfiguredRef.current = true;
        }
      });
    }
  }, [enableSchemaValidation]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;

    // Configure JSON schema validation if enabled
    if (enableSchemaValidation) {
      loadVegaLiteSchema().then((schema) => {
        if (schema) {
          configureJsonSchema(monaco, schema);
          schemaConfiguredRef.current = true;
        }
      });
    }

    // Format on initial load
    setTimeout(() => {
      editor.getAction('editor.action.formatDocument')?.run();
    }, 100);

    // Call the original onMount if provided
    onMount?.(editor, monaco);
  };

  return (
    <MonacoEditor
      language="json"
      value={value}
      onChange={onChange}
      onMount={handleEditorDidMount}
      className={className}
      readOnly={readOnly}
      options={{
        formatOnPaste: true,
        formatOnType: true,
        folding: true,
        foldingStrategy: 'indentation',
        ...options,
      }}
      {...props}
    />
  );
};

/**
 * Configure Monaco JSON schema validation for Vega-Lite
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function configureJsonSchema(monaco: any, schema: object) {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    schemas: [
      {
        uri: 'https://vega.github.io/schema/vega-lite/v5.json',
        fileMatch: ['*'],
        schema: schema as Record<string, unknown>,
      },
    ],
    enableSchemaRequest: false,
  });
}
