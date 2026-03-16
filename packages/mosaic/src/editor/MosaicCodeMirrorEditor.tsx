import {
  JsonCodeMirrorEditor,
  JsonCodeMirrorEditorProps,
} from '@sqlrooms/codemirror';
import React, {useEffect, useState} from 'react';
import {loadMosaicSchema} from './mosaicSchema';

export interface MosaicCodeMirrorEditorProps extends Omit<
  JsonCodeMirrorEditorProps,
  'schema'
> {
  /**
   * Whether to enable Mosaic JSON schema validation
   * @default true
   */
  enableSchemaValidation?: boolean;
}

/**
 * A CodeMirror editor specialized for editing Mosaic vgplot specifications.
 * Automatically loads and configures the Mosaic JSON schema for validation.
 */
export const MosaicCodeMirrorEditor: React.FC<MosaicCodeMirrorEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  className,
  enableSchemaValidation = false,
  ...props
}) => {
  const [schema, setSchema] = useState<object | null>(null);

  useEffect(() => {
    if (enableSchemaValidation) {
      loadMosaicSchema().then((loadedSchema) => {
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
