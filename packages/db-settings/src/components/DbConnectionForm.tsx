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
import {CheckIcon, LoaderIcon, PlusIcon, PlugIcon, XIcon} from 'lucide-react';
import React from 'react';
import {useStoreWithDbSettings} from '../DbSettingsSlice';

export type DbConnectionFormProps = {
  editing?: DbConnection;
  onDone?: () => void;
};

function buildConnection(
  editing: DbConnection | undefined,
  engineId: string,
  connectionId: string,
  title: string,
  bridgeId: string,
  config: Record<string, string>,
): DbConnection | null {
  if (!connectionId.trim() || !engineId.trim()) return null;
  const cleanConfig: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (v) cleanConfig[k] = v;
  }
  return DbConnection.parse({
    id: connectionId.trim(),
    engineId: engineId.trim(),
    title: title.trim() || connectionId.trim(),
    runtimeSupport: editing?.runtimeSupport ?? 'server',
    requiresBridge: editing?.requiresBridge ?? true,
    bridgeId: bridgeId.trim() || undefined,
    isCore: false,
    config: Object.keys(cleanConfig).length > 0 ? cleanConfig : undefined,
  });
}

export function DbConnectionForm({editing, onDone}: DbConnectionFormProps) {
  const upsertConnection = useStoreWithDbSettings(
    (s) => s.dbSettings.upsertConnection,
  );
  const supportedEngines = useStoreWithDbSettings(
    (s) => s.dbSettings.config.supportedEngines,
  );
  const engineConfigFields = useStoreWithDbSettings(
    (s) => s.dbSettings.config.engineConfigFields,
  );
  const [engineId, setEngineId] = React.useState<string>(
    editing?.engineId ?? supportedEngines[0] ?? '',
  );
  const [connectionId, setConnectionId] = React.useState(editing?.id ?? '');
  const [title, setTitle] = React.useState(editing?.title ?? '');
  const [bridgeId, setBridgeId] = React.useState(editing?.bridgeId ?? '');
  const [config, setConfig] = React.useState<Record<string, string>>(
    editing?.config ?? {},
  );

  const originalRef = React.useRef(editing);
  const suppressSyncRef = React.useRef(false);
  const hasInitializedRef = React.useRef(false);

  React.useEffect(() => {
    if (editing) {
      suppressSyncRef.current = true;
      setEngineId(editing.engineId);
      setConnectionId(editing.id);
      setTitle(editing.title);
      setBridgeId(editing.bridgeId ?? '');
      setConfig(editing.config ?? {});
      if (!hasInitializedRef.current) {
        originalRef.current = editing;
        hasInitializedRef.current = true;
      }
    } else {
      hasInitializedRef.current = false;
    }
  }, [editing]);

  // In edit mode, auto-sync changes to the store so "Save to config" always
  // reflects the latest form state without requiring the user to click Done first.
  // suppressSyncRef breaks the loop: prop change → local state → store → prop change.
  const isEditing = !!editing;
  React.useEffect(() => {
    if (!isEditing) return;
    if (suppressSyncRef.current) {
      suppressSyncRef.current = false;
      return;
    }
    const conn = buildConnection(
      editing,
      engineId,
      connectionId,
      title,
      bridgeId,
      config,
    );
    if (conn) upsertConnection(conn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, engineId, connectionId, title, bridgeId, config]);

  const fields = engineConfigFields[engineId] ?? [];

  const reset = () => {
    setEngineId(supportedEngines[0] ?? '');
    setConnectionId('');
    setTitle('');
    setBridgeId('');
    setConfig({});
  };

  const handleEngineChange = (newEngine: string) => {
    setEngineId(newEngine);
    if (!editing) setConfig({});
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfig((prev) => ({...prev, [key]: value}));
  };

  const handleCancel = () => {
    if (originalRef.current) {
      upsertConnection(originalRef.current);
    }
    onDone?.();
  };

  const testConnection = useStoreWithDbSettings(
    (s) => s.dbSettings.testConnection,
  );
  const [testState, setTestState] = React.useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [testError, setTestError] = React.useState('');

  const handleTestConnection = async () => {
    if (!engineId) return;
    setTestState('testing');
    setTestError('');
    const cleanConfig: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      if (v) cleanConfig[k] = v;
    }
    const result = await testConnection(engineId, cleanConfig);
    if (result.ok) {
      setTestState('success');
    } else {
      setTestState('error');
      setTestError(result.error ?? 'Connection failed');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const conn = buildConnection(
      editing,
      engineId,
      connectionId,
      title,
      bridgeId,
      config,
    );
    if (!conn) return;
    upsertConnection(conn);

    if (!editing) reset();
    onDone?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {editing ? 'Edit Connection' : 'Add Connection'}
        </div>
        {onDone && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleCancel}
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="db-conn-engine" className="text-xs">
            Engine
          </Label>
          <Select value={engineId} onValueChange={handleEngineChange}>
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

        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`db-conn-cfg-${field.key}`} className="text-xs">
              {field.label}
              {field.required && <span className="ml-0.5 text-red-500">*</span>}
            </Label>
            <Input
              id={`db-conn-cfg-${field.key}`}
              type={field.secret ? 'password' : 'text'}
              value={config[field.key] ?? ''}
              onChange={(e) => handleConfigChange(field.key, e.target.value)}
              placeholder={field.placeholder ?? ''}
              required={field.required}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!connectionId.trim()}>
          {editing ? (
            <>
              <CheckIcon className="mr-1 h-3.5 w-3.5" />
              Done
            </>
          ) : (
            <>
              <PlusIcon className="mr-1 h-3.5 w-3.5" />
              Add
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!engineId || testState === 'testing'}
          onClick={handleTestConnection}
        >
          {testState === 'testing' ? (
            <LoaderIcon className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlugIcon className="mr-1 h-3.5 w-3.5" />
          )}
          Test
        </Button>
        {testState === 'success' && (
          <span className="text-xs text-green-600">Connected</span>
        )}
        {testState === 'error' && (
          <span
            className="max-w-[200px] truncate text-xs text-red-600"
            title={testError}
          >
            {testError}
          </span>
        )}
        {editing && onDone && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
