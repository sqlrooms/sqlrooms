import {TableIcon} from 'lucide-react';

export function SchemaPanel() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <TableIcon className="h-4 w-4" />
        Schema
      </div>
      <div className="text-muted-foreground text-xs">
        Browse table schemas and column definitions.
      </div>
      <div className="border-border flex flex-col gap-1 rounded border p-3">
        <div className="text-sm font-medium">sample_data</div>
        <div className="text-muted-foreground font-mono text-xs">
          <div>id: INTEGER</div>
          <div>name: VARCHAR</div>
          <div>value: DOUBLE</div>
          <div>created_at: TIMESTAMP</div>
        </div>
      </div>
    </div>
  );
}
