import {DbConnection} from '@sqlrooms/db';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {CheckIcon, PlusIcon, XIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithDbSettings} from '../DbSettingsSlice';

export type DbConnectionFormProps = {
  editing?: DbConnection;
  onDone?: () => void;
};

export function DbConnectionForm({editing, onDone}: DbConnectionFormProps) {
  const upsertConnection = useStoreWithDbSettings(
    (s) => s.dbSettings.upsertConnection,
  );
  const supportedEngines = useStoreWithDbSettings(
    (s) => s.dbSettings.config.supportedEngines,
  );
  const [engineId, setEngineId] = React.useState<string>(
    editing?.engineId ?? supportedEngines[0] ?? '',
  );
  const [connectionId, setConnectionId] = React.useState(editing?.id ?? '');
  const [title, setTitle] = React.useState(editing?.title ?? '');
  const [bridgeId, setBridgeId] = React.useState(editing?.bridgeId ?? '');

  React.useEffect(() => {
    if (editing) {
      setEngineId(editing.engineId);
      setConnectionId(editing.id);
      setTitle(editing.title);
      setBridgeId(editing.bridgeId ?? '');
    }
  }, [editing]);

  const reset = () => {
    setEngineId(supportedEngines[0] ?? '');
    setConnectionId('');
    setTitle('');
    setBridgeId('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionId.trim() || !engineId.trim()) return;

    const connection = DbConnection.parse({
      id: connectionId.trim(),
      engineId: engineId.trim(),
      title: title.trim() || connectionId.trim(),
      runtimeSupport: editing?.runtimeSupport ?? 'server',
      requiresBridge: editing?.requiresBridge ?? true,
      bridgeId: bridgeId.trim() || undefined,
      isCore: false,
    });
    upsertConnection(connection);

    if (!editing) reset();
    onDone?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border p-3">
      <div className="text-sm font-medium">
        {editing ? 'Edit Connection' : 'Add Connection'}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="db-conn-engine" className="text-xs">
            Engine
          </Label>
          <Select value={engineId} onValueChange={setEngineId}>
            <SelectTrigger id="db-conn-engine">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedEngines.map((eng) => (
                <SelectItem key={eng} value={eng}>
                  {eng}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="db-conn-id" className="text-xs">
            Connection ID
          </Label>
          <Input
            id="db-conn-id"
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            placeholder="my-postgres"
            required
            disabled={!!editing}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="db-conn-title" className="text-xs">
            Title
          </Label>
          <Input
            id="db-conn-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Postgres DB"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="db-conn-bridge" className="text-xs">
            Bridge ID (optional)
          </Label>
          <Input
            id="db-conn-bridge"
            value={bridgeId}
            onChange={(e) => setBridgeId(e.target.value)}
            placeholder="sqlrooms-cli-http-bridge"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!connectionId.trim()}>
          {editing ? (
            <>
              <CheckIcon className="mr-1 h-3.5 w-3.5" />
              Save
            </>
          ) : (
            <>
              <PlusIcon className="mr-1 h-3.5 w-3.5" />
              Add
            </>
          )}
        </Button>
        {editing && onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            <XIcon className="mr-1 h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
