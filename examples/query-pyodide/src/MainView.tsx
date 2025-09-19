import {useRoomStore} from './store';

export const MainView = () => {
  const lastError = useRoomStore((s) => s.sql.lastError);
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center text-sm text-muted-foreground">
        <div className="mb-2 font-medium">Pyodide DuckDB Example</div>
        <div>Type SQL on the editor panel to run queries.</div>
        {lastError ? (
          <div className="mt-2 text-red-600">{String(lastError)}</div>
        ) : null}
      </div>
    </div>
  );
};

