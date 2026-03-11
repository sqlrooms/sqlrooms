import React, {useState} from 'react';
import {type DataTable} from '@sqlrooms/duckdb';
import {SqlCodeMirrorEditor, SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {type EditorType} from './EditorTypeSwitch';

// Example SQL query
const initialSqlQuery = `-- Sample SQL query
SELECT
  id,
  name,
  email,
  status,
  created_at
FROM users
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 10;`;

// Example table schemas for SQL autocomplete
const tableSchemas: DataTable[] = [
  {
    table: {
      table: 'users',
      toString: () => 'users',
    },
    isView: false,
    schema: 'main',
    tableName: 'users',
    columns: [
      {name: 'id', type: 'INTEGER'},
      {name: 'name', type: 'VARCHAR'},
      {name: 'email', type: 'VARCHAR'},
      {name: 'age', type: 'INTEGER'},
      {name: 'status', type: 'VARCHAR'},
      {name: 'created_at', type: 'TIMESTAMP'},
    ],
  },
  {
    table: {
      table: 'orders',
      toString: () => 'orders',
    },
    isView: false,
    schema: 'main',
    tableName: 'orders',
    columns: [
      {name: 'id', type: 'INTEGER'},
      {name: 'user_id', type: 'INTEGER'},
      {name: 'product_name', type: 'VARCHAR'},
      {name: 'amount', type: 'DECIMAL'},
      {name: 'order_date', type: 'TIMESTAMP'},
    ],
  },
];

interface SqlEditorProps {
  editorType: EditorType;
  className?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  editorType,
  className,
}) => {
  const [sqlValue, setSqlValue] = useState(initialSqlQuery);

  const handleRunQuery = (query: string) => {
    console.log('Run query:', query);
    alert(`Would execute query:\n\n${query}`);
  };
  if (editorType === 'monaco') {
    return (
      <SqlMonacoEditor
        tableSchemas={tableSchemas}
        value={sqlValue}
        onChange={(value: string | undefined) => setSqlValue(value || '')}
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
    <SqlCodeMirrorEditor
      tableSchemas={tableSchemas}
      value={sqlValue}
      onChange={(value: string) => setSqlValue(value)}
      onRunQuery={handleRunQuery}
      className={className}
      options={{
        lineNumbers: true,
        lineWrapping: true,
      }}
    />
  );
};
