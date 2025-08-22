import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {Handle, Position} from '@xyflow/react';
import {CanvasNodeData, useStoreWithCanvas} from '../CanvasSlice';
import {FC} from 'react';
import {AddChildButton} from '../AddChildButton';

type SqlData = Extract<CanvasNodeData, {type: 'sql'}>;

export const SqlNode: FC<{id: string; data: SqlData}> = ({id, data}) => {
  const sql = data.sql || '';
  const addChild = useStoreWithCanvas((s) => s.canvas.addNode);
  const updateNode = useStoreWithCanvas((s) => s.canvas.updateNode);
  const tables = useStoreWithCanvas((s) => s.db.tables);
  return (
    <div className="relative w-[420px] rounded-md border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
        <span>{data.title}</span>
        <span className="text-[10px] uppercase text-gray-500">SQL</span>
      </div>
      <div className="p-2">
        <SqlMonacoEditor
          value={sql}
          height={160}
          options={{minimap: {enabled: false}}}
          onChange={(v) =>
            updateNode(id, (d) => ({...(d as SqlData), sql: v || ''}))
          }
          tableSchemas={tables}
        />
      </div>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <AddChildButton onClick={() => addChild({parentId: id})} />
    </div>
  );
};
