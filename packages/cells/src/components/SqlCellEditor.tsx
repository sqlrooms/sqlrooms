import type {DataTable, DuckDbConnector} from '@sqlrooms/duckdb';
import {SqlCodeMirrorEditor} from '@sqlrooms/sql-editor';
import React, {useState} from 'react';
import {CollapsibleSectionButton} from './CollapsibleSectionButton';
import {SqlQueryPreview} from './SqlQueryPreview';

export interface SqlCellEditorProps {
  sql: string;
  connector?: DuckDbConnector;
  tableSchemas?: DataTable[];
  onChange: (value: string | undefined) => void;
  onRunQuery: (query: string) => void;
}

/**
 * SQL query editor with collapse/expand functionality
 */
export const SqlCellEditor: React.FC<SqlCellEditorProps> = ({
  sql,
  connector,
  tableSchemas,
  onChange,
  onRunQuery,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="group relative w-full py-1">
      <CollapsibleSectionButton
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />
      {isCollapsed ? (
        <div className="text-muted-foreground ml-5 px-2 py-1 text-xs">
          {sql && <SqlQueryPreview sql={sql} />}
        </div>
      ) : (
        <div className="w-full px-1">
          <SqlCodeMirrorEditor
            className="h-auto min-h-[48px] w-full"
            connector={connector}
            tableSchemas={tableSchemas}
            value={sql}
            onChange={onChange}
            onRunQuery={onRunQuery}
            options={{
              lineNumbers: true,
              lineWrapping: false,
              highlightActiveLine: true,
            }}
          />
        </div>
      )}
    </div>
  );
};
