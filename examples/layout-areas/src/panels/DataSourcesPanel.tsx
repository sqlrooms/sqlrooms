import {DatabaseIcon} from 'lucide-react';

export function DataSourcesPanel() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <DatabaseIcon className="h-4 w-4" />
        Data Sources
      </div>
      <div className="text-muted-foreground text-xs">
        Manage your data connections and files here.
      </div>
      <div className="border-border flex flex-col gap-2 rounded border p-3">
        <div className="text-sm font-medium">sample_data.csv</div>
        <div className="text-muted-foreground text-xs">
          1,234 rows · 12 columns
        </div>
      </div>
      <div className="border-border flex flex-col gap-2 rounded border p-3">
        <div className="text-sm font-medium">users.parquet</div>
        <div className="text-muted-foreground text-xs">
          5,678 rows · 8 columns
        </div>
      </div>
    </div>
  );
}
