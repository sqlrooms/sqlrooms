import {DuckdbCodeMirrorEditor} from '@sqlrooms/codemirror';
import {type DataTable} from '@sqlrooms/duckdb';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {type EditorType} from './EditorTypeSwitch';

interface SqlEditorProps {
  editorType: EditorType;
  tableSchemas: DataTable[];
  value: string;
  onChange: (value: string) => void;
  onRunQuery?: (query: string) => void;
  className?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  editorType,
  tableSchemas,
  value,
  onChange,
  onRunQuery,
  className,
}) => {
  if (editorType === 'monaco') {
    return (
      <SqlMonacoEditor
        tableSchemas={tableSchemas}
        value={value}
        onChange={(value: string | undefined) => onChange(value || '')}
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
    <DuckdbCodeMirrorEditor
      tableSchemas={tableSchemas}
      value={value}
      onChange={(value: string) => onChange(value)}
      onRunQuery={onRunQuery}
      className={className}
      options={{
        lineNumbers: true,
        lineWrapping: true,
      }}
    />
  );
};
