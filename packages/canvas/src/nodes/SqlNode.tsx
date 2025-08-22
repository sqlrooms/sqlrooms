import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {CanvasNodeData, useStoreWithCanvas} from '../CanvasSlice';
import {FC} from 'react';
import {CanvasNodeContainer} from './CanvasNodeContainer';

type SqlData = Extract<CanvasNodeData, {type: 'sql'}>;

export const SqlNode: FC<{id: string; data: SqlData}> = ({id, data}) => {
  const sql = data.sql || '';
  const updateNode = useStoreWithCanvas((s) => s.canvas.updateNode);
  const tables = useStoreWithCanvas((s) => s.db.tables);
  return (
    <CanvasNodeContainer id={id}>
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
          <span>{data.title}</span>
          <span className="text-[10px] uppercase text-gray-500">SQL</span>
        </div>
        <div className="relative flex-1">
          <SqlMonacoEditor
            className="absolute inset-0 p-1"
            value={sql}
            options={{minimap: {enabled: false}, lineNumbers: 'off'}}
            onChange={(v) =>
              updateNode(id, (d) => ({...(d as SqlData), sql: v || ''}))
            }
            tableSchemas={tables}
          />
        </div>
      </div>
    </CanvasNodeContainer>
  );
};
