import type {DbConnection} from '@sqlrooms/db';
import {Badge, Button} from '@sqlrooms/ui';
import {PencilIcon, Trash2Icon} from 'lucide-react';
import React from 'react';
import type {ConnectorDriverDiagnostic} from '../DbSettingsSliceConfig';
import {useStoreWithDbSettings} from '../DbSettingsSlice';
import {DbConnectionForm} from './DbConnectionForm';

function ConnectionRow({
  connection,
  diagnostic,
  onEdit,
  onRemove,
}: {
  connection: DbConnection;
  diagnostic?: ConnectorDriverDiagnostic;
  onEdit?: (connection: DbConnection) => void;
  onRemove?: (id: string) => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const isEditable = !connection.isCore;

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
      {isEditable && (
        <>
          {confirming ? (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  onRemove?.(connection.id);
                  setConfirming(false);
                }}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-0.5">
              {onEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onEdit(connection)}
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </Button>
              )}
              {onRemove && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </>
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
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const diagnosticsByKey = React.useMemo(() => {
    const map = new Map<string, ConnectorDriverDiagnostic>();
    for (const d of diagnostics) {
      map.set(`${d.id}:${d.engineId}`, d);
    }
    return map;
  }, [diagnostics]);

  const editingConnection = React.useMemo(
    () => (editingId ? connections.find((c) => c.id === editingId) : undefined),
    [editingId, connections],
  );

  if (!connections.length && !editingId) {
    return (
      <div className="text-muted-foreground py-4 text-center text-sm">
        No connections configured.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {connections.map((connection) =>
        editingId === connection.id ? (
          <DbConnectionForm
            key={connection.id}
            editing={editingConnection}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <ConnectionRow
            key={connection.id}
            connection={connection}
            diagnostic={diagnosticsByKey.get(
              `${connection.id}:${connection.engineId}`,
            )}
            onEdit={(c) => setEditingId(c.id)}
            onRemove={removeConnection}
          />
        ),
      )}
    </div>
  );
}
