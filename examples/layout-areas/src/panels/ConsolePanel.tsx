import {TerminalIcon} from 'lucide-react';

export function ConsolePanel() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <TerminalIcon className="h-4 w-4" />
        Console
      </div>
      <div className="bg-muted flex flex-1 flex-col gap-1 rounded p-3 font-mono text-xs">
        <div className="text-muted-foreground">
          [10:23:15] Connected to DuckDB
        </div>
        <div className="text-muted-foreground">
          [10:23:16] Loaded sample_data.csv (1,234 rows)
        </div>
        <div className="text-green-600">
          [10:23:18] Query executed successfully (0.032s)
        </div>
        <div className="text-muted-foreground">[10:23:18] 50 rows returned</div>
      </div>
    </div>
  );
}
