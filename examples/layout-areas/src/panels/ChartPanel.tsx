import {BarChart3Icon} from 'lucide-react';

export function ChartPanel() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BarChart3Icon className="h-4 w-4" />
        Chart
      </div>
      <div className="text-muted-foreground text-xs">
        Visualization of query results.
      </div>
      <div className="flex flex-1 items-end gap-2 rounded p-4">
        {[65, 45, 78, 52, 90, 38, 72, 60, 85, 42].map((h, i) => (
          <div
            key={i}
            className="bg-primary/60 flex-1 rounded-t"
            style={{height: `${h}%`}}
          />
        ))}
      </div>
    </div>
  );
}
