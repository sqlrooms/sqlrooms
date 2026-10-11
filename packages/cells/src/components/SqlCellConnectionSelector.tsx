import {getCoreDuckDbConnectionId, type DbConnection} from '@sqlrooms/db';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import React, {useMemo} from 'react';

export type SqlCellConnectionSelectorProps = {
  connectors: Record<string, DbConnection>;
  selectedConnectorId: string;
  onChange: (connectorId: string) => void;
};

export const SqlCellConnectionSelector: React.FC<
  SqlCellConnectionSelectorProps
> = ({connectors, selectedConnectorId, onChange}) => {
  const connectionOptions = useMemo(() => {
    const entries = Object.values(connectors);
    if (!entries.length) {
      return [{id: getCoreDuckDbConnectionId(), title: 'Core DuckDB'}];
    }

    return entries.map(({id, title}) => ({
      id,
      title: title || id,
    }));
  }, [connectors]);

  if (connectionOptions.length <= 1) {
    return null;
  }

  return (
    <div className="flex-1">
      <Select value={selectedConnectorId} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {connectionOptions.map(({id, title}) => (
            <SelectItem key={id} value={id}>
              {title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
