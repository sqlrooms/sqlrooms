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
import {PlusIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithDbSettings} from '../DbSettingsSlice';

const SUPPORTED_ENGINES = ['postgres', 'snowflake'] as const;

export function DbConnectionForm({onSaved}: {onSaved?: () => void}) {
  const upsertConnection = useStoreWithDbSettings(
    (s) => s.dbSettings.upsertConnection,
  );
  const [engineId, setEngineId] = React.useState<string>('postgres');
  const [connectionId, setConnectionId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [bridgeId, setBridgeId] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionId.trim() || !engineId.trim()) return;

    const connection = DbConnection.parse({
      id: connectionId.trim(),
      engineId: engineId.trim(),
      title: title.trim() || connectionId.trim(),
      runtimeSupport: 'server',
      requiresBridge: true,
      bridgeId: bridgeId.trim() || undefined,
      isCore: false,
    });
    upsertConnection(connection);

    setConnectionId('');
    setTitle('');
    setBridgeId('');
    onSaved?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border p-3">
      <div className="text-sm font-medium">Add Connection</div>
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
              {SUPPORTED_ENGINES.map((eng) => (
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
      <Button type="submit" size="sm" disabled={!connectionId.trim()}>
        <PlusIcon className="mr-1 h-3.5 w-3.5" />
        Add
      </Button>
    </form>
  );
}
