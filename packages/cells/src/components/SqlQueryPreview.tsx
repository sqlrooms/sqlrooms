import React, {useMemo} from 'react';
import {getSqlQueryPreview} from '../utils';

export interface SqlQueryPreviewProps {
  sql: string;
}

/**
 * Shows a preview of SQL code - displays first non-empty line with "..." if more lines exist
 */
export const SqlQueryPreview: React.FC<SqlQueryPreviewProps> = ({sql}) => {
  const {firstLine, hasMoreLines} = useMemo(
    () => getSqlQueryPreview(sql),
    [sql],
  );

  if (!firstLine) {
    return null;
  }

  return (
    <>
      <span className="truncate font-mono">{firstLine}</span>
      {hasMoreLines && <span className="ml-1">...</span>}
    </>
  );
};
