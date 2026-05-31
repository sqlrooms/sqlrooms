import {
  SqlQueryBlock,
  SQL_QUERY_BLOCK_TYPE,
} from '@sqlrooms/sql-editor';
import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';

export const WorksheetSqlQueryBlockRenderer = ({
  blockInstanceId,
  blockType,
  title,
  readOnly,
}: BlockDocumentStatefulBlockRendererProps) => {
  if (!blockInstanceId || blockType !== SQL_QUERY_BLOCK_TYPE) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  return (
    <SqlQueryBlock
      queryId={blockInstanceId}
      title={title ?? 'SQL Query'}
      readOnly={readOnly}
      className="h-full"
    />
  );
};
