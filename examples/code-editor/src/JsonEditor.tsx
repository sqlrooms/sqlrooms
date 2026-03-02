import {JsonCodeMirrorEditor} from '@sqlrooms/codemirror-editor';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {type EditorType} from './EditorTypeSwitch';

interface JsonEditorProps {
  editorType: EditorType;
  schema: object;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  editorType,
  schema,
  value,
  onChange,
  className,
}) => {
  if (editorType === 'monaco') {
    return (
      <JsonMonacoEditor
        schema={schema}
        value={value}
        onChange={(value) => onChange(value || '')}
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
      schema={schema}
      value={value}
      onChange={(value) => onChange(value)}
      className={className}
      options={{
        lineNumbers: true,
        lineWrapping: true,
      }}
    />
  );
};
