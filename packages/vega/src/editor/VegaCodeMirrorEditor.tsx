import {
  JsonCodeMirrorEditor,
  JsonCodeMirrorEditorProps,
} from '@sqlrooms/codemirror';
import React, {useEffect, useState} from 'react';
import {loadVegaLiteSchema} from '../schema/vegaLiteSchema';

export interface VegaCodeMirrorEditorProps extends Omit<
  JsonCodeMirrorEditorProps,
  'schema'
> {
  /**
   * Whether to enable Vega-Lite JSON schema validation
   * @default true
   */
  enableSchemaValidation?: boolean;
}

/**
 * A CodeMirror editor specialized for editing Vega-Lite specifications.
 * Automatically loads and configures the Vega-Lite JSON schema for validation.
 */
export const VegaCodeMirrorEditor: React.FC<VegaCodeMirrorEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  className,
  enableSchemaValidation = true,
  ...props
}) => {
  const [schema, setSchema] = useState<object | null>(null);

  // Load Vega-Lite schema on mount
  useEffect(() => {
    if (enableSchemaValidation) {
      loadVegaLiteSchema().then((loadedSchema) => {
        if (loadedSchema) {
          setSchema(loadedSchema);
        }
      });
    }
  }, [enableSchemaValidation]);

  return (
    <JsonCodeMirrorEditor
      value={value}
      onChange={onChange}
      schema={enableSchemaValidation ? (schema ?? undefined) : undefined}
      readOnly={readOnly}
      className={className}
      {...props}
    />
  );
};
