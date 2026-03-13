import {getCoreDuckDbConnectionId, type DbConnection} from '@sqlrooms/db';
import React, {useMemo} from 'react';

export type SqlCellConnectionSelectorProps = {
  dbConnections: Record<string, DbConnection>;
  selectedConnectorId: string;
  onChange: (connectorId: string) => void;
};

export const SqlCellConnectionSelector: React.FC<
  SqlCellConnectionSelectorProps
> = ({dbConnections, selectedConnectorId, onChange}) => {
  const connectionOptions = useMemo(() => {
    const entries = Object.values(dbConnections);
    if (!entries.length) {
      return [{id: getCoreDuckDbConnectionId(), title: 'Core DuckDB'}];
    }
    return entries.map((conn: DbConnection) => ({
      id: conn.id,
      title: conn.title || conn.id,
    }));
  }, [dbConnections]);

  if (connectionOptions.length <= 1) {
    return null;
  }

  return (
    <div className="flex-1">
      <select
        className="border-input bg-background text-foreground h-7 rounded border px-2 text-xs"
        value={selectedConnectorId}
        onChange={(e) => onChange(e.target.value)}
      >
        {connectionOptions.map((connection) => (
          <option key={connection.id} value={connection.id}>
            {connection.title}
          </option>
        ))}
      </select>
    </div>
  );
};
