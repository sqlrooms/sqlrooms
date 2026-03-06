import {JavascriptCodeMirrorEditor} from '@sqlrooms/codemirror';
import {MonacoEditor} from '@sqlrooms/monaco-editor';
import {type EditorType} from './EditorTypeSwitch';

interface JavascriptEditorProps {
  editorType: EditorType;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const JavascriptEditor: React.FC<JavascriptEditorProps> = ({
  editorType,
  value,
  onChange,
  className,
}) => {
  if (editorType === 'monaco') {
    return (
      <MonacoEditor
        language="javascript"
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
    <JavascriptCodeMirrorEditor
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
