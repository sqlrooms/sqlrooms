import type {DbConnection} from '@sqlrooms/db';
import {Badge, Button} from '@sqlrooms/ui';
import {Trash2Icon} from 'lucide-react';
import React from 'react';
import type {ConnectorDriverDiagnostic} from '../DbSettingsSliceConfig';
import {useStoreWithDbSettings} from '../DbSettingsSlice';

function ConnectionRow({
  connection,
  diagnostic,
  onRemove,
}: {
  connection: DbConnection;
  diagnostic?: ConnectorDriverDiagnostic;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{connection.title}</span>
          <Badge variant="outline" className="text-xs">
            {connection.engineId}
          </Badge>
          {diagnostic && !diagnostic.available && (
            <Badge variant="destructive" className="text-xs">
              Driver missing
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          ID: {connection.id}
          {connection.bridgeId ? ` · Bridge: ${connection.bridgeId}` : ''}
        </div>
      </div>
      {onRemove && !connection.isCore && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => onRemove(connection.id)}
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export function DbConnectionsList() {
  const connections = useStoreWithDbSettings(
    (s) => s.dbSettings.config.connections,
  );
  const diagnostics = useStoreWithDbSettings(
    (s) => s.dbSettings.config.diagnostics,
  );
  const removeConnection = useStoreWithDbSettings(
    (s) => s.dbSettings.removeConnection,
  );

  const diagnosticsByKey = React.useMemo(() => {
    const map = new Map<string, ConnectorDriverDiagnostic>();
    for (const d of diagnostics) {
      map.set(`${d.id}:${d.engineId}`, d);
    }
    return map;
  }, [diagnostics]);

  if (!connections.length) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        No connections configured.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {connections.map((connection) => (
        <ConnectionRow
          key={connection.id}
          connection={connection}
          diagnostic={diagnosticsByKey.get(
            `${connection.id}:${connection.engineId}`,
          )}
          onRemove={removeConnection}
        />
      ))}
    </div>
  );
}
